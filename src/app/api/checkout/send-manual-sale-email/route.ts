import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendReceiptEmail, sendAdminOrderEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { saleId } = await request.json();
    if (!saleId) {
      return NextResponse.json({ error: 'saleId is required' }, { status: 400 });
    }

    const db = getSupabaseAdmin();

    // 1. Fetch sale
    const { data: sale, error: saleError } = await db
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (saleError || !sale) {
      console.error('[send-manual-sale-email] Sale not found:', saleError);
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    // Check if email already sent to prevent duplicates
    if (sale.receipt_sent_at) {
      return NextResponse.json({ success: true, message: 'Email already sent' });
    }

    // 2. Fetch sale items
    const { data: items, error: itemsError } = await db
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId);

    if (itemsError || !items) {
      console.error('[send-manual-sale-email] Items error:', itemsError);
      return NextResponse.json({ error: 'Could not load sale items' }, { status: 500 });
    }

    // 3. Build baseUrl
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const shippingInfo = sale.shipping_address as any;
    const shippingMethodLabel = shippingInfo?.method === 'recogida' ? 'Recogida en taller' : 'Envío a domicilio (Península)';
    const shippingCost = shippingInfo?.price ?? 0;
    const paymentMethodLabel = sale.payment_type === 'BIZUM' ? 'Bizum / Transferencia' : 'PayPal';

    // 4. Send buyer email (Resguardo de reserva)
    if (sale.buyer_email) {
      try {
        await sendReceiptEmail({
          to: sale.buyer_email,
          buyerName: sale.buyer_name || 'Cliente',
          orderNumber: sale.order_number || saleId.slice(0, 8),
          items: items.map((i) => ({ title: i.title, price: i.price })),
          total: sale.total_price,
          paymentMethod: paymentMethodLabel,
          shippingMethodLabel,
          shippingCost,
          saleId: sale.id,
          baseUrl,
          isReservation: true, // This is a reservation email!
        });

        // Update receipt_sent_at
        await db
          .from('sales')
          .update({ receipt_sent_at: new Date().toISOString() })
          .eq('id', sale.id);
      } catch (emailErr) {
        console.error('[send-manual-sale-email] Buyer email failed:', emailErr);
      }
    }

    // 5. Send admin email
    try {
      await sendAdminOrderEmail({
        orderNumber: sale.order_number || saleId.slice(0, 8),
        buyerName: sale.buyer_name || 'Cliente',
        buyerEmail: sale.buyer_email || '',
        buyerWhatsapp: sale.receipt_whatsapp, // WhatsApp number or link is fine
        items: items.map((i) => ({ title: i.title, price: i.price })),
        total: sale.total_price,
        shippingAddress: sale.shipping_address,
        paymentMethod: paymentMethodLabel,
      });
    } catch (adminErr) {
      console.error('[send-manual-sale-email] Admin email failed:', adminErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[send-manual-sale-email] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
