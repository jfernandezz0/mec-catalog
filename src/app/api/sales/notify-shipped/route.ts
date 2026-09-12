import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendShippingEmail } from '@/lib/email';
import { verifyAdminSession } from '@/lib/utils.server';
import type { ShippingAddress } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify admin session
    const authResult = await verifyAdminSession(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

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
    const shippingInfo = sale.shipping_address as ShippingAddress | null;
    const shippingCost = shippingInfo?.price ?? 0;
    const shippingMethodLabel =
      shippingInfo?.description ||
      (shippingInfo?.method === 'recogida' ? 'Recogida en taller (León)' : 'Envío Peninsular');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mec-catalog.vercel.app';

    await sendShippingEmail({
      to: toEmail,
      buyerName: sale.buyer_name || 'Cliente',
      orderNumber: sale.order_number || `MEC-${sale.id.toUpperCase().slice(0, 8)}`,
      items: (saleItems ?? []).map((i: { title: string; price: number | string }) => ({ title: i.title, price: Number(i.price) })),
      total: Number(sale.total_price),
      paymentMethod: sale.payment_type,
      shippingMethodLabel,
      shippingCost: Number(shippingCost),
      saleId: sale.id,
      trackingLink: trackingLink || null,
      baseUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notify-shipped] Error:', err);
    const message = err instanceof Error ? err.message : 'Error al enviar la notificación';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
