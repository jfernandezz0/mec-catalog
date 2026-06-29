import { NextRequest, NextResponse } from 'next/server';
import { createManualSale } from '@/lib/orders';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cartItems,
      buyerName,
      buyerEmail,
      buyerWhatsapp,
      shippingAddress,
      total,
      paymentMethod,
      delayEmail,
    } = body;

    // Validate inputs
    if (!cartItems || !buyerName || !buyerEmail || !total || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (paymentMethod !== 'BIZUM' && paymentMethod !== 'PAYPAL') {
      return NextResponse.json({ error: 'Invalid manual payment method' }, { status: 400 });
    }

    // Build dynamic baseUrl from request headers to support any domain/localhost dynamically
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Create the manual sale (stock reservation confirmation, email dispatch, admin alerts)
    const { orderNumber, saleId, whatsappLink } = await createManualSale({
      paymentMethod,
      cart: cartItems,
      buyer: {
        name: buyerName,
        email: buyerEmail,
        whatsapp: buyerWhatsapp || null,
        shippingAddress: shippingAddress || null,
      },
      total,
      baseUrl,
      delayEmail: !!delayEmail,
    });

    return NextResponse.json({
      success: true,
      orderNumber,
      saleId,
      whatsappLink,
    });
  } catch (err: any) {
    console.error('[create-manual-sale] Error:', err);
    return NextResponse.json({ error: err.message || 'Manual checkout failed' }, { status: 500 });
  }
}
