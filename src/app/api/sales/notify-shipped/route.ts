import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendShippingEmail } from '@/lib/email';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    // 1. Verify admin session cookie
    const token = req.cookies.get('sb-session')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado. Debes iniciar sesión como administrador.' },
        { status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user || user.email !== 'minienginescreations@gmail.com') {
      return NextResponse.json(
        { error: 'Acceso denegado. No tienes permisos de administrador.' },
        { status: 401 }
      );
    }

    const { saleId, trackingLink } = await req.json();

    if (!saleId) {
      return NextResponse.json({ error: 'saleId is required' }, { status: 400 });
    }

    // Fetch full sale + items from DB
    const { data: sale, error: saleErr } = await supabaseAdmin
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (saleErr || !sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    const { data: saleItems, error: itemsErr } = await supabaseAdmin
      .from('sale_items')
      .select('title, price')
      .eq('sale_id', saleId);

    if (itemsErr) {
      return NextResponse.json({ error: 'Could not load sale items' }, { status: 500 });
    }

    const toEmail = sale.receipt_email || sale.buyer_email;
    if (!toEmail) {
      return NextResponse.json({ error: 'No email address for buyer' }, { status: 400 });
    }

    // Build shipping method label from shipping_address
    const shippingInfo = sale.shipping_address as any;
    const shippingCost = shippingInfo?.price ?? 0;
    const shippingMethodLabel =
      shippingInfo?.description ||
      (shippingInfo?.method === 'recogida' ? 'Recogida en taller (León)' : 'Envío Peninsular');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mec-catalog.vercel.app';

    await sendShippingEmail({
      to: toEmail,
      buyerName: sale.buyer_name || 'Cliente',
      orderNumber: sale.order_number || `MEC-${sale.id.toUpperCase().slice(0, 8)}`,
      items: (saleItems ?? []).map((i: any) => ({ title: i.title, price: Number(i.price) })),
      total: Number(sale.total_price),
      paymentMethod: sale.payment_type,
      shippingMethodLabel,
      shippingCost: Number(shippingCost),
      saleId: sale.id,
      trackingLink: trackingLink || null,
      baseUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[notify-shipped] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
