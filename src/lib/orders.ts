import { getSupabaseAdmin } from '@/lib/supabase';
import { sendReceiptEmail, sendAdminOrderEmail } from '@/lib/email';
import { buildReceiptWhatsAppLink } from '@/lib/whatsapp';
import { squareClient } from '@/lib/square';

interface CartItem {
  articleId: number;
  title: string;
  priceAtCheckout: number;
  quantity?: number;
}

interface BuyerInfo {
  name: string;
  email: string;
  whatsapp?: string | null;
  shippingAddress?: {
    address?: string;
    postalCode?: string;
    city?: string;
    province?: string;
    country?: string;
    method?: string;
    price?: number;
    description?: string;
  } | null;
}

/** Generate a human-readable order number: MEC-YYYY-NNNN */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const db = getSupabaseAdmin();
  const { count } = await db
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01T00:00:00Z`);
  const seq = String((count ?? 0) + 1).padStart(4, '0');
  return `MEC-${year}-${seq}`;
}

/**
 * Reserve stock for an article atomically.
 * Returns true if reservation succeeded, false if already reserved/sold.
 */
export async function reserveStock(articleId: number): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc('reserve_article_stock', {
    p_article_id: articleId,
    p_minutes: 3,
  });
  if (error) {
    console.error('[reserveStock] RPC error:', error);
    return false;
  }
  return data === true;
}

/** Release a stock reservation (payment failed / user abandoned) */
export async function releaseStock(articleId: number): Promise<void> {
  const db = getSupabaseAdmin();
  await db.from('articles').update({ reserved_until: null }).eq('id', articleId);
}

/**
 * Confirm purchase: decrement stock, clear reservation.
 * Called after successful payment.
 */
export async function confirmStock(articleId: number, qty: number = 1): Promise<void> {
  const db = getSupabaseAdmin();
  const { data: art } = await db
    .from('articles')
    .select('quantity')
    .eq('id', articleId)
    .single();

  if (art) {
    const newQty = Math.max(0, art.quantity - qty);
    const { error } = await db
      .from('articles')
      .update({ quantity: newQty, reserved_until: null })
      .eq('id', articleId);
    if (error) {
      console.error('[confirmStock] Error:', error);
      throw new Error('Failed to decrement stock');
    }
  }
}

/**
 * Create a sale record in Supabase after successful payment.
 * Handles: sale row, stock decrement, receipt email, WhatsApp link.
 */
export async function createSaleFromPayment(params: {
  squarePaymentId: string;
  squareOrderId?: string;
  cart: CartItem[];
  buyer: BuyerInfo;
  total: number;
  baseUrl?: string;
}): Promise<{ orderNumber: string; whatsappLink: string | null }> {
  const { squarePaymentId, squareOrderId, cart, buyer, total, baseUrl = 'https://www.minienginescreations.com' } = params;

  const orderNumber = await generateOrderNumber();
  const db = getSupabaseAdmin();

  // 1. Insert sale
  const { data: sale, error: saleError } = await db
    .from('sales')
    .insert({
      payment_type: 'SQUARE',
      status: 'COMPLETADA',
      total_price: total,
      total_articles: cart.length,
      buyer_name: buyer.name,
      receipt_email: buyer.email,
      receipt_whatsapp: buyer.whatsapp || null,
      whatsapp_sent: false,
      shipping_address: buyer.shippingAddress || null,
      shipping_status: 'PENDIENTE',
      square_payment_id: squarePaymentId,
      square_order_id: squareOrderId || null,
      order_number: orderNumber,
      // Legacy fields (keep compatible)
      buyer_email: buyer.email,
      buyer_instagram: null,
      location: 'online',
    })
    .select('id')
    .single();

  if (saleError || !sale) {
    console.error('[createSaleFromPayment] Sale insert error:', saleError);
    throw new Error('Failed to create sale record');
  }

  // 2. Insert sale_items + decrement stock
  for (const item of cart) {
    const qty = item.quantity || 1;
    const { data: artData } = await db
      .from('articles')
      .select('quantity')
      .eq('id', item.articleId)
      .single();

    const isPrepurchase = artData ? artData.quantity <= 0 : false;

    await db.from('sale_items').insert({
      sale_id: sale.id,
      article_id: item.articleId,
      title: item.title,
      quantity: qty,
      price: item.priceAtCheckout,
      is_prepurchase: isPrepurchase,
    });

    await confirmStock(item.articleId, qty);
  }

  // 3. Receipt email to buyer
  try {
    const shippingInfo = buyer.shippingAddress as any;
    const shippingMethodLabel = shippingInfo?.method === 'recogida' ? 'Recogida en taller' : 'Envío a domicilio (Península)';
    const shippingCost = shippingInfo?.price ?? 0;

    await sendReceiptEmail({
      to: buyer.email,
      buyerName: buyer.name,
      orderNumber,
      items: cart.map((i) => ({ title: i.title, price: i.priceAtCheckout })),
      total,
      paymentMethod: 'Pago con tarjeta (Square)',
      shippingMethodLabel,
      shippingCost,
      saleId: sale.id,
      baseUrl,
    });

    await db
      .from('sales')
      .update({ receipt_sent_at: new Date().toISOString() })
      .eq('id', sale.id);
  } catch (emailErr) {
    console.error('[createSaleFromPayment] Receipt email failed:', emailErr);
    // Don't block — sale is already created
  }

  // 4. Admin notification email
  try {
    await sendAdminOrderEmail({
      orderNumber,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      buyerWhatsapp: buyer.whatsapp,
      items: cart.map((i) => ({ title: i.title, price: i.priceAtCheckout })),
      total,
      shippingAddress: buyer.shippingAddress,
      paymentMethod: 'Pago con tarjeta (Square)',
    });
  } catch (err) {
    console.error('[createSaleFromPayment] Admin email failed:', err);
  }

  // 5. Build WhatsApp link (if buyer provided phone)
  let whatsappLink: string | null = null;
  const cleanedWhatsapp = buyer.whatsapp ? buyer.whatsapp.replace(/\D/g, '') : '';
  const hasRealWhatsapp = cleanedWhatsapp !== '34' && cleanedWhatsapp !== '';

  if (buyer.whatsapp && hasRealWhatsapp) {
    const shippingInfo = buyer.shippingAddress as any;
    const shippingCost = shippingInfo?.price ?? 0;

    whatsappLink = buildReceiptWhatsAppLink({
      phone: buyer.whatsapp,
      buyerName: buyer.name,
      orderNumber,
      items: cart.map((i) => ({ title: i.title, price: i.priceAtCheckout })),
      total,
      shippingCost,
    });

    await db
      .from('sales')
      .update({ receipt_whatsapp: whatsappLink })
      .eq('id', sale.id);
  }

  return { orderNumber, whatsappLink };
}

/**
 * Create a manual sale record (Bizum / PayPal)
 * Status is set to 'PRECOMPRA' since payment needs manual verification.
 */
export async function createManualSale(params: {
  paymentMethod: 'BIZUM' | 'PAYPAL';
  cart: CartItem[];
  buyer: BuyerInfo;
  total: number;
  baseUrl?: string;
  delayEmail?: boolean;
}): Promise<{ orderNumber: string; saleId: string; whatsappLink: string | null }> {
  const { paymentMethod, cart, buyer, total, baseUrl = 'https://www.minienginescreations.com', delayEmail = false } = params;

  const orderNumber = await generateOrderNumber();
  const db = getSupabaseAdmin();

  // 1. Insert sale
  const { data: sale, error: saleError } = await db
    .from('sales')
    .insert({
      payment_type: paymentMethod,
      status: 'PRECOMPRA', // Pending verification
      total_price: total,
      total_articles: cart.length,
      buyer_name: buyer.name,
      receipt_email: buyer.email,
      receipt_whatsapp: buyer.whatsapp || null,
      whatsapp_sent: false,
      shipping_address: buyer.shippingAddress || null,
      shipping_status: 'PENDIENTE',
      square_payment_id: null,
      square_order_id: null,
      order_number: orderNumber,
      // Legacy fields
      buyer_email: buyer.email,
      buyer_instagram: null,
      location: 'online',
    })
    .select('id')
    .single();

  if (saleError || !sale) {
    console.error('[createManualSale] Sale insert error:', saleError);
    throw new Error('Failed to create manual sale record');
  }

  // 2. Insert sale_items + decrement stock
  for (const item of cart) {
    const qty = item.quantity || 1;
    await db.from('sale_items').insert({
      sale_id: sale.id,
      article_id: item.articleId,
      title: item.title,
      quantity: qty,
      price: item.priceAtCheckout,
      is_prepurchase: true,
    });

    await confirmStock(item.articleId, qty);
  }

  const paymentMethodLabel = paymentMethod === 'BIZUM' ? 'Bizum / Transferencia' : 'PayPal';

  // 3. Receipt email to buyer & Admin notification (if not delayed)
  if (!delayEmail) {
    try {
      const shippingInfo = buyer.shippingAddress as any;
      const shippingMethodLabel = shippingInfo?.method === 'recogida' ? 'Recogida en taller' : 'Envío a domicilio (Península)';
      const shippingCost = shippingInfo?.price ?? 0;

      await sendReceiptEmail({
        to: buyer.email,
        buyerName: buyer.name,
        orderNumber,
        items: cart.map((i) => ({ title: i.title, price: i.priceAtCheckout })),
        total,
        paymentMethod: paymentMethodLabel,
        shippingMethodLabel,
        shippingCost,
        saleId: sale.id,
        baseUrl,
        isReservation: true,
      });

      await db
        .from('sales')
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq('id', sale.id);
    } catch (emailErr) {
      console.error('[createManualSale] Receipt email failed:', emailErr);
    }

    try {
      await sendAdminOrderEmail({
        orderNumber,
        buyerName: buyer.name,
        buyerEmail: buyer.email,
        buyerWhatsapp: buyer.whatsapp,
        items: cart.map((i) => ({ title: i.title, price: i.priceAtCheckout })),
        total,
        shippingAddress: buyer.shippingAddress,
        paymentMethod: paymentMethodLabel,
      });
    } catch (err) {
      console.error('[createManualSale] Admin email failed:', err);
    }
  }

  // 5. WhatsApp link (if provided)
  let whatsappLink: string | null = null;
  const cleanedWhatsapp = buyer.whatsapp ? buyer.whatsapp.replace(/\D/g, '') : '';
  const hasRealWhatsapp = cleanedWhatsapp !== '34' && cleanedWhatsapp !== '';

  if (buyer.whatsapp && hasRealWhatsapp) {
    const shippingInfo = buyer.shippingAddress as any;
    const shippingCost = shippingInfo?.price ?? 0;

    whatsappLink = buildReceiptWhatsAppLink({
      phone: buyer.whatsapp,
      buyerName: buyer.name,
      orderNumber,
      items: cart.map((i) => ({ title: i.title, price: i.priceAtCheckout })),
      total,
      shippingCost,
    });

    await db
      .from('sales')
      .update({ receipt_whatsapp: whatsappLink })
      .eq('id', sale.id);
  }

  return { orderNumber, saleId: sale.id, whatsappLink };
}

/** Handles creating a sale from a presencial (in-person) Square POS/Reader transaction */
export async function createSaleFromPresencialOrder(params: {
  paymentId: string;
  orderId: string;
  baseUrl?: string;
}): Promise<boolean> {
  const { paymentId, orderId, baseUrl = 'https://www.minienginescreations.com' } = params;
  const db = getSupabaseAdmin();

  // 1. Fetch Order from Square
  console.log(`[presencial-sale] Retrieving order ${orderId} from Square...`);
  const orderRes = await squareClient.orders.get({ orderId });
  const order = orderRes.order;

  if (!order) {
    console.error(`[presencial-sale] Order ${orderId} not found in Square`);
    return false;
  }

  // Determine payment type from order tenders (e.g. CASH vs CARD)
  const isCash = order.tenders?.some((t) => t.type === 'CASH') ?? false;
  const paymentType: 'SQUARE' | 'EFECTIVO' = isCash ? 'EFECTIVO' : 'SQUARE';

  const variationIds = order.lineItems
    ?.map((item) => item.catalogObjectId)
    .filter((id): id is string => !!id) ?? [];

  if (variationIds.length === 0) {
    console.log(`[presencial-sale] No catalog items in order ${orderId}, skipping`);
    return false;
  }

  // 2. Lookup matching articles in Supabase
  const { data: matchedArticles, error: matchErr } = await db
    .from('articles')
    .select('id, title, price, square_catalog_item_id')
    .in('square_catalog_item_id', variationIds);

  if (matchErr) {
    console.error(`[presencial-sale] Error querying Supabase articles:`, matchErr);
    return false;
  }

  if (!matchedArticles || matchedArticles.length === 0) {
    console.log(`[presencial-sale] No articles in Supabase match variation IDs:`, variationIds);
    return false;
  }

  // 3. Resolve buyer info
  let buyerName = 'Venta Presencial (Tap to Pay)';
  let buyerEmail: string | null = null;
  let buyerPhone: string | null = null;

  if (order.customerId) {
    try {
      const { customer } = await squareClient.customers.get({ customerId: order.customerId });
      if (customer) {
        buyerName = [customer.givenName, customer.familyName].filter(Boolean).join(' ') || buyerName;
        buyerEmail = customer.emailAddress || null;
        buyerPhone = customer.phoneNumber || null;
      }
    } catch (customerErr) {
      console.warn(`[presencial-sale] Failed to fetch customer details:`, customerErr);
    }
  }

  const cart = matchedArticles.map((art) => ({
    articleId: art.id,
    title: art.title,
    priceAtCheckout: Number(art.price),
  }));

  const orderNumber = await generateOrderNumber();
  const totalPrice = Number(order.totalMoney?.amount ? Number(order.totalMoney.amount) / 100 : cart.reduce((sum, item) => sum + item.priceAtCheckout, 0));

  // 4. Create Sale in Supabase
  const { data: sale, error: saleError } = await db
    .from('sales')
    .insert({
      payment_type: paymentType,
      status: 'COMPLETADA',
      total_price: totalPrice,
      total_articles: cart.length,
      buyer_name: buyerName,
      receipt_email: buyerEmail,
      receipt_whatsapp: buyerPhone,
      whatsapp_sent: false,
      shipping_address: null,
      shipping_status: 'ENTREGADO',
      square_payment_id: paymentId,
      square_order_id: orderId,
      order_number: orderNumber,
      buyer_email: buyerEmail,
      buyer_instagram: null,
      location: 'presencial',
    })
    .select('id')
    .single();

  if (saleError || !sale) {
    console.error(`[presencial-sale] Failed to insert sale record:`, saleError);
    return false;
  }

  // 5. Insert sale items and decrement stock
  for (const item of cart) {
    const lineItem = order.lineItems?.find(
      (li) => li.catalogObjectId === matchedArticles.find((ma) => ma.id === item.articleId)?.square_catalog_item_id
    );
    const qty = lineItem?.quantity ? Number(lineItem.quantity) : 1;

    await db.from('sale_items').insert({
      sale_id: sale.id,
      article_id: item.articleId,
      title: item.title,
      quantity: qty,
      price: item.priceAtCheckout,
      is_prepurchase: false,
    });

    // Mark quantity as decremented and clear reservation
    const { data: art } = await db
      .from('articles')
      .select('quantity')
      .eq('id', item.articleId)
      .single();

    if (art) {
      const newQty = Math.max(0, art.quantity - qty);
      await db
        .from('articles')
        .update({ quantity: newQty, reserved_until: null })
        .eq('id', item.articleId);
    }
  }

  console.log(`[presencial-sale] Successfully processed presencial sale ${orderNumber} for order ${orderId}`);

  // 6. Send receipt email if email is available
  if (buyerEmail) {
    try {
      await sendReceiptEmail({
        to: buyerEmail,
        buyerName,
        orderNumber,
        items: cart.map((i) => ({ title: i.title, price: i.priceAtCheckout })),
        total: totalPrice,
        paymentMethod: 'Pago con tarjeta (Square)',
        shippingMethodLabel: 'Venta presencial',
        shippingCost: 0,
        saleId: sale.id,
        baseUrl,
      });
      await db
        .from('sales')
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq('id', sale.id);
    } catch (emailErr) {
      console.error(`[presencial-sale] Failed to send customer receipt email:`, emailErr);
    }
  }

  // 7. Send notification email to admin
  try {
    await sendAdminOrderEmail({
      orderNumber,
      buyerName,
      buyerEmail: buyerEmail || 'N/A',
      buyerWhatsapp: buyerPhone,
      items: cart.map((i) => ({ title: i.title, price: i.priceAtCheckout })),
      total: totalPrice,
      shippingAddress: null,
      paymentMethod: 'Pago presencial (Tap to Pay)',
    });
  } catch (adminEmailErr) {
    console.error(`[presencial-sale] Failed to send admin notification email:`, adminEmailErr);
  }

  return true;
}

