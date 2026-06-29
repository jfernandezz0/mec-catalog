import { NextRequest, NextResponse } from 'next/server';
import { squareClient, squareLocationId } from '@/lib/square';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createSaleFromPayment } from '@/lib/orders';
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

    // Fetch article details for the cart record
    const { data: articles } = await db
      .from('articles')
      .select('id, title, price')
      .in('id', articleIds);

    const cartItems = (articles ?? []).map((a) => ({
      articleId: a.id,
      title: a.title,
      priceAtCheckout: Number(a.price),
    }));

    // Create Square payment
    const { payment } = await squareClient.payments.create({
      sourceId,
      idempotencyKey,
      amountMoney: {
        amount: amountCents,
        currency: 'EUR',
      },
      locationId: squareLocationId,
      buyerEmailAddress: buyerEmail,
      note: `MEC Catalog — ${buyerName}`,
    });

    if (!payment?.id) {
      return NextResponse.json({ error: 'Payment creation failed' }, { status: 402 });
    }

    // Build dynamic baseUrl from request headers to support any domain/localhost dynamically
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // ── CREATE SALE IMMEDIATELY (Synchronous flow) ──
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
