import { NextRequest, NextResponse } from 'next/server';
import { createManualSale } from '@/lib/orders';
import { getSupabaseAdmin } from '@/lib/supabase';
import { calculateDiscount } from '@/lib/discounts';
import type { ShippingAddress } from '@/lib/types';

interface ManualCartItemInput {
  articleId: number;
  quantity?: number;
  title?: string;
  priceAtCheckout?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cartItems: rawCartItems,
      buyerName,
      buyerEmail,
      buyerWhatsapp,
      shippingAddress,
      paymentMethod,
      delayEmail,
    } = body;

    // Validate inputs
    if (!Array.isArray(rawCartItems) || rawCartItems.length === 0 || !buyerName || !buyerEmail || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (paymentMethod !== 'BIZUM' && paymentMethod !== 'PAYPAL') {
      return NextResponse.json({ error: 'Invalid manual payment method' }, { status: 400 });
    }

    const requestedItems = (rawCartItems as ManualCartItemInput[]).map((item) => ({
      articleId: Number(item.articleId),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    }));

    const articleIds = requestedItems.map((i) => i.articleId);
    const db = getSupabaseAdmin();

    const { data: articles } = await db
      .from('articles')
      .select('id, title, price, quantity, discount_type, discount_value, category_id, categories(discount_percent)')
      .in('id', articleIds);

    const { data: settingsData } = await db
      .from('settings')
      .select('key, value');
    const settingsMap = new Map(settingsData?.map((s) => [s.key, s.value]) || []);
    const generalDiscountPercent = settingsMap.get('general_discount_percent') || '';

    interface FetchedArticleForManualSale {
      id: number;
      title: string;
      price: number;
      quantity: number;
      discount_type?: string | null;
      discount_value?: number | null;
      categories?: { discount_percent: number | null } | null;
    }

    const fetchedArticles = (articles as unknown as FetchedArticleForManualSale[]) ?? [];
    const articleMap = new Map(fetchedArticles.map((a) => [a.id, a]));

    const verifiedCartItems: { articleId: number; title: string; priceAtCheckout: number; quantity: number }[] = [];
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

      verifiedCartItems.push({
        articleId: a.id,
        title: a.title,
        priceAtCheckout: discount.finalPrice,
        quantity: reqItem.quantity,
      });
    }

    const serverSubtotal = verifiedCartItems.reduce((sum, item) => sum + item.priceAtCheckout * item.quantity, 0);
    const isDelivery = shippingAddress?.method === 'envio';
    const serverShippingCost = isDelivery ? 9.99 : 0;
    const serverTotal = Number((serverSubtotal + serverShippingCost).toFixed(2));
    const normalizedShippingAddress: ShippingAddress | null = shippingAddress
      ? { ...shippingAddress, price: serverShippingCost }
      : null;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mec-catalog.vercel.app';

    // Create the manual sale (stock reservation confirmation, email dispatch, admin alerts)
    const { orderNumber, saleId, whatsappLink } = await createManualSale({
      paymentMethod,
      cart: verifiedCartItems,
      buyer: {
        name: buyerName,
        email: buyerEmail,
        whatsapp: buyerWhatsapp || null,
        shippingAddress: normalizedShippingAddress,
      },
      total: serverTotal,
      baseUrl,
      delayEmail: !!delayEmail,
    });

    return NextResponse.json({
      success: true,
      orderNumber,
      saleId,
      whatsappLink,
      total: serverTotal,
    });
  } catch (err) {
    console.error('[create-manual-sale] Error:', err);
    const message = err instanceof Error ? err.message : 'Manual checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
