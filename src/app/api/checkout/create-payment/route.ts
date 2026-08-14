import { NextRequest, NextResponse } from 'next/server';
import { squareClient, squareLocationId } from '@/lib/square';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createSaleFromPayment } from '@/lib/orders';
import { calculateDiscount } from '@/lib/discounts';
import { randomUUID } from 'crypto';

interface CreatePaymentBody {
  sourceId: string;
  articleIds: number[];
  total: number;
  buyerEmail: string;
  buyerName: string;
  buyerWhatsapp?: string | null;
  shippingAddress?: {
    address: string;
    postalCode: string;
    city: string;
    province: string;
    country: string;
    method?: string;
    price?: number;
    description?: string;
  } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreatePaymentBody;
    const { sourceId, articleIds, total, buyerEmail, buyerName, buyerWhatsapp, shippingAddress } = body;

    if (!sourceId || !articleIds?.length || !total || !buyerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Double-check stock before charging
    const db = getSupabaseAdmin();
    for (const id of articleIds) {
      const { data: article } = await db
        .from('articles')
        .select('id, quantity')
        .eq('id', id)
        .single();

      if (!article || article.quantity <= 0) {
        return NextResponse.json(
          { error: `El artículo ya no está disponible`, articleId: id },
          { status: 409 },
        );
      }
    }

    const amountCents = BigInt(Math.round(total * 100));
    const idempotencyKey = randomUUID();

    // Fetch article details along with discounts for the cart record
    const { data: articles } = await db
      .from('articles')
      .select('id, title, price, discount_type, discount_value, category_id, categories(discount_percent)')
      .in('id', articleIds);

    const { data: settingsData } = await db
      .from('settings')
      .select('key, value');
    const settingsMap = new Map(settingsData?.map((s) => [s.key, s.value]) || []);
    const generalDiscountPercent = settingsMap.get('general_discount_percent') || '';

    const cartItems = (articles ?? []).map((a: any) => {
      const catDiscount = a.categories?.discount_percent ?? null;
      const discount = calculateDiscount(
        a.price,
        a.discount_type,
        a.discount_value,
        catDiscount,
        generalDiscountPercent
      );
      return {
        articleId: a.id,
        title: a.title,
        priceAtCheckout: discount.finalPrice,
      };
    });

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
        shippingAddress: shippingAddress || null,
      },
      total,
    });

    if (pendingErr) {
      console.error('[create-payment] Failed to create pending checkout session:', pendingErr);
      return NextResponse.json({ error: 'Failed to initiate checkout session' }, { status: 500 });
    }

    // ── STEP 2: CREATE SQUARE PAYMENT ──
    let payment: any;
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
    } catch (err: any) {
      console.error('[create-payment] Square payment creation exception:', err);
      
      // Delete the pending checkout session on definitive client-side errors (4xx, like card declined)
      // but preserve it on server-side errors/timeouts (5xx) so webhook fallback can recover it
      const statusCode = err?.statusCode || err?.status;
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

    // Build dynamic baseUrl from request headers to support any domain/localhost dynamically
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // ── STEP 4: CREATE SALE IMMEDIATELY (Synchronous flow) ──
    const { orderNumber } = await createSaleFromPayment({
      squarePaymentId: payment.id,
      squareOrderId: payment.orderId,
      cart: cartItems,
      buyer: {
        name: buyerName,
        email: buyerEmail,
        whatsapp: buyerWhatsapp || null,
        shippingAddress: shippingAddress || null,
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
  } catch (err: any) {
    console.error('[create-payment] Error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
