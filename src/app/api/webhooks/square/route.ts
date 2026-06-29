import { NextRequest, NextResponse } from 'next/server';
import { verifySquareWebhookSignature } from '@/lib/square';
import { createSaleFromPayment, releaseStock, createSaleFromPresencialOrder } from '@/lib/orders';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('x-square-hmacsha256-signature') ?? '';
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!;
    const notificationUrl =
      process.env.SQUARE_WEBHOOK_URL ??
      `${request.nextUrl.origin}/api/webhooks/square`;

    // Verify signature
    const isValid = verifySquareWebhookSignature(
      rawBody,
      signatureHeader,
      signatureKey,
      notificationUrl,
    );

    if (!isValid) {
      console.warn('[square-webhook] Invalid signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.type ?? '';
    const paymentObject = event.data?.object?.payment;

    if (!paymentObject) {
      return NextResponse.json({ received: true });
    }

    const paymentId: string = paymentObject.id;
    const status: string = paymentObject.status;

    console.log(`[square-webhook] ${eventType} — payment ${paymentId} — status ${status}`);

    const db = getSupabaseAdmin();

    // payment.updated with COMPLETED status → process the order
    if (eventType === 'payment.updated' && status === 'COMPLETED') {
      // Build dynamic baseUrl from request headers to support any domain/localhost dynamically
      const host = request.headers.get('host') || 'localhost:3000';
      const protocol = host.startsWith('localhost') ? 'http' : 'https';
      const baseUrl = `${protocol}://${host}`;

      // 1. Check if the sale was already processed synchronously
      const { data: existingSale } = await db
        .from('sales')
        .select('id')
        .eq('square_payment_id', paymentId)
        .single();

      if (existingSale) {
        console.log('[square-webhook] Sale already created synchronously for payment:', paymentId);
        // Clean up pending record if exists
        await db.from('pending_checkouts').delete().eq('square_payment_id', paymentId);
        return NextResponse.json({ received: true });
      }

      // 2. Fallback: Retrieve pending checkout session from Supabase
      const { data: pending } = await db
        .from('pending_checkouts')
        .select('*')
        .eq('square_payment_id', paymentId)
        .single();

      if (!pending) {
        // Fallback for Tap to Pay presencial orders (made directly on POS app / iPhone)
        if (paymentObject.orderId) {
          console.log('[square-webhook] No pending checkout found. Attempting to process as a presencial order for:', paymentObject.orderId);
          try {
            const processed = await createSaleFromPresencialOrder({
              paymentId,
              orderId: paymentObject.orderId,
              baseUrl,
            });
            if (processed) {
              console.log('[square-webhook] Presencial order processed successfully');
            } else {
              console.log('[square-webhook] Order was not a registered catalog item or failed processing');
            }
          } catch (err) {
            console.error('[square-webhook] Error processing presencial order:', err);
          }
        } else {
          console.warn('[square-webhook] No pending checkout or orderId for payment:', paymentId);
        }
        return NextResponse.json({ received: true });
      }

      await createSaleFromPayment({
        squarePaymentId: paymentId,
        squareOrderId: paymentObject.orderId,
        cart: pending.cart_items,
        buyer: pending.buyer,
        total: pending.total,
        baseUrl,
      });

      // Clean up pending record
      await db
        .from('pending_checkouts')
        .delete()
        .eq('square_payment_id', paymentId);
    }

    // payment.updated with FAILED/CANCELED → release reservation
    if (
      eventType === 'payment.updated' &&
      (status === 'FAILED' || status === 'CANCELED')
    ) {
      const { data: pending } = await db
        .from('pending_checkouts')
        .select('cart_items')
        .eq('square_payment_id', paymentId)
        .single();

      if (pending?.cart_items) {
        const ids = (pending.cart_items as { articleId: number }[]).map((i) => i.articleId);
        await Promise.all(ids.map((id) => releaseStock(id)));
      }

      await db
        .from('pending_checkouts')
        .delete()
        .eq('square_payment_id', paymentId);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[square-webhook] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
