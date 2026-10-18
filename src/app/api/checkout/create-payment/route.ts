import { NextRequest, NextResponse } from 'next/server';
import { squareClient, squareLocationId } from '@/lib/square';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createSaleFromPayment } from '@/lib/orders';
import { calculateDiscount } from '@/lib/discounts';
import { ShippingAddress } from '@/lib/types';
import { randomUUID } from 'crypto';

interface CartItemInput {
  articleId: number;
  quantity?: number;
  title?: string;
  priceAtCheckout?: number;
}

interface CreatePaymentBody {
  sourceId: string;
  cartItems?: CartItemInput[];
  articleIds?: number[];
  total?: number;
  buyerEmail: string;
  buyerName: string;
  buyerWhatsapp?: string | null;
  shippingAddress?: ShippingAddress | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreatePaymentBody;
    const { sourceId, cartItems: rawCartItems, articleIds: rawArticleIds, buyerEmail, buyerName, buyerWhatsapp, shippingAddress } = body;

    const requestedItems: { articleId: number; quantity: number }[] = Array.isArray(rawCartItems) && rawCartItems.length > 0
      ? rawCartItems.map((item) => ({
          articleId: Number(item.articleId),
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        }))
      : Array.isArray(rawArticleIds) && rawArticleIds.length > 0
        ? rawArticleIds.map((id) => ({ articleId: Number(id), quantity: 1 }))
        : [];

    if (!sourceId || requestedItems.length === 0 || !buyerEmail || !buyerName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const articleIds = requestedItems.map((i) => i.articleId);
    const db = getSupabaseAdmin();

    // Fetch article details along with stock and discounts from DB
    const { data: articles } = await db
      .from('articles')
      .select('id, title, price, quantity, discount_type, discount_value, category_id, categories(discount_percent)')
      .in('id', articleIds);

    const { data: settingsData } = await db
      .from('settings')
      .select('key, value');
    const settingsMap = new Map(settingsData?.map((s) => [s.key, s.value]) || []);
    const generalDiscountPercent = settingsMap.get('general_discount_percent') || '';

    interface FetchedArticleForPayment {
      id: number;
      title: string;
      price: number;
      quantity: number;
      discount_type?: string | null;
      discount_value?: number | null;
      categories?: { discount_percent: number | null } | null;
    }

    const fetchedArticles = (articles as unknown as FetchedArticleForPayment[]) ?? [];
    const articleMap = new Map(fetchedArticles.map((a) => [a.id, a]));

    // Verify stock and compute server-authoritative prices
    const cartItems: { articleId: number; title: string; priceAtCheckout: number; quantity: number }[] = [];
    for (const reqItem of requestedItems) {
      const a = articleMap.get(reqItem.articleId);
      if (!a || a.quantity < reqItem.quantity || a.quantity <= 0) {
        return NextResponse.json(
          { error: 'El artículo ya no tiene stock suficiente disponible', articleId: reqItem.articleId },
          { status: 409 },
        );
      }

      const catDiscount = a.categories?.discount_percent ?? null;
      const discount = calculateDiscount(
        a.price,
        a.discount_type,
        a.discount_value,
        catDiscount,
        generalDiscountPercent
      );

      cartItems.push({
        articleId: a.id,
        title: a.title,
        priceAtCheckout: discount.finalPrice,
        quantity: reqItem.quantity,
      });
    }

    const serverSubtotal = cartItems.reduce((sum, item) => sum + item.priceAtCheckout * item.quantity, 0);
    const isDelivery = shippingAddress?.method === 'envio';
    const serverShippingCost = isDelivery ? 9.99 : 0;
    const total = Number((serverSubtotal + serverShippingCost).toFixed(2));
    const normalizedShippingAddress: ShippingAddress | null = shippingAddress
      ? { ...shippingAddress, price: serverShippingCost }
      : null;

    const amountCents = BigInt(Math.round(total * 100));
    const idempotencyKey = randomUUID();
    const checkoutSessionId = randomUUID();

    // ── STEP 1: CREATE PENDING CHECKOUT IN DATABASE AS SAFETY NET ──
    const { error: pendingErr } = await db.from('pending_checkouts').insert({
      id: checkoutSessionId,
      square_payment_id: `PENDING_${checkoutSessionId}`,
      cart_items: cartItems,
      buyer: {
        name: buyerName,
        email: buyerEmail,
        whatsapp: buyerWhatsapp || null,
        shippingAddress: normalizedShippingAddress,
      },
      total,
    });

    if (pendingErr) {
      console.error('[create-payment] Failed to create pending checkout session:', pendingErr);
      return NextResponse.json({ error: 'Failed to initiate checkout session' }, { status: 500 });
    }

    // ── STEP 2: CREATE SQUARE PAYMENT ──
    type SquarePayment = NonNullable<Awaited<ReturnType<typeof squareClient.payments.create>>['payment']>;
    let payment: SquarePayment | undefined;
    try {
      const paymentRes = await squareClient.payments.create({
        sourceId,
        idempotencyKey,
        amountMoney: {
          amount: amountCents,
          currency: 'EUR',
        },
        locationId: squareLocationId,
        buyerEmailAddress: buyerEmail,
        note: `MEC Catalog — ${buyerName}`,
        referenceId: checkoutSessionId,
      });
      payment = paymentRes.payment;
    } catch (err: unknown) {
      console.error('[create-payment] Square payment creation exception:', err);
      
      // Delete the pending checkout session on definitive client-side errors (4xx, like card declined)
      // but preserve it on server-side errors/timeouts (5xx) so webhook fallback can recover it
      const errorObj = err as { statusCode?: number; status?: number };
      const statusCode = errorObj?.statusCode || errorObj?.status;
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        await db.from('pending_checkouts').delete().eq('id', checkoutSessionId);
      }
      throw err;
    }

    if (!payment?.id) {
      await db.from('pending_checkouts').delete().eq('id', checkoutSessionId);
      return NextResponse.json({ error: 'Payment creation failed' }, { status: 402 });
    }

    // ── STEP 3: UPDATE PENDING CHECKOUT WITH THE ACTUAL PAYMENT ID ──
    await db
      .from('pending_checkouts')
      .update({ square_payment_id: payment.id })
      .eq('id', checkoutSessionId);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mec-catalog.vercel.app';

    // ── STEP 4: CREATE SALE IMMEDIATELY (Synchronous flow) ──
    const { orderNumber } = await createSaleFromPayment({
      squarePaymentId: payment.id,
      squareOrderId: payment.orderId,
      cart: cartItems,
      buyer: {
        name: buyerName,
        email: buyerEmail,
        whatsapp: buyerWhatsapp || null,
        shippingAddress: normalizedShippingAddress,
      },
      total,
      baseUrl,
    });

    // ── STEP 5: CLEAN UP SESSION ──
    await db.from('pending_checkouts').delete().eq('id', checkoutSessionId);

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      status: payment.status,
      orderNumber,
    });
  } catch (err) {
    console.error('[create-payment] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
