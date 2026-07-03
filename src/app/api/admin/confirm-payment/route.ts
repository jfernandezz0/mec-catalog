import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendReceiptEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin authentication via Bearer token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado. Debes iniciar sesión como administrador.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user || user.email !== 'minienginescreations@gmail.com') {
      return NextResponse.json(
        { error: 'Acceso denegado. No tienes permisos de administrador.' },
        { status: 401 }
      );
    }

    const { saleId } = await request.json();
    if (!saleId) {
      return NextResponse.json({ error: 'saleId is required' }, { status: 400 });
    }

    // 2. Fetch sale details using admin client to bypass RLS if needed
    const dbAdmin = getSupabaseAdmin();
    const { data: sale, error: saleError } = await dbAdmin
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (saleError || !sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    // 3. Fetch sale items
    const { data: items, error: itemsError } = await dbAdmin
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId);

    if (itemsError || !items) {
      return NextResponse.json({ error: 'Could not load sale items' }, { status: 500 });
    }

    // 4. Update status to COMPLETADA
    const { error: updateError } = await dbAdmin
      .from('sales')
      .update({ status: 'COMPLETADA' })
      .eq('id', saleId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update sale status' }, { status: 500 });
    }

    // 5. Send final confirmation email (only if buyer email is available)
    if (sale.buyer_email) {
      const host = request.headers.get('host') || 'localhost:3000';
      const protocol = host.startsWith('localhost') ? 'http' : 'https';
      const baseUrl = `${protocol}://${host}`;

      const shippingInfo = sale.shipping_address as any;
      const shippingMethodLabel = shippingInfo?.method === 'recogida' ? 'Recogida en taller' : 'Envío a domicilio (Península)';
      const shippingCost = shippingInfo?.price ?? 0;
      const paymentMethodLabel = sale.payment_type === 'BIZUM' ? 'Bizum / Transferencia' : 
                                 sale.payment_type === 'PAYPAL' ? 'PayPal' : 'Pago con tarjeta';

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
          isReservation: false, // Final confirmation!
        });

        // Update receipt_sent_at
        await dbAdmin
          .from('sales')
          .update({ receipt_sent_at: new Date().toISOString() })
          .eq('id', sale.id);
      } catch (emailErr) {
        console.error('[confirm-payment] Email sending failed:', emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[confirm-payment] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
