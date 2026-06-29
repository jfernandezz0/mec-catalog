/**
 * WhatsApp receipt link builder (wa.me — free, no API required)
 * The admin clicks the generated link from their phone to send the receipt.
 */

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

interface ReceiptItem {
  title: string;
  price: number;
}

/**
 * Builds a wa.me URL with a pre-written receipt message.
 * The admin opens this link on their phone → WhatsApp opens with message ready to send.
 */
export function buildReceiptWhatsAppLink(params: {
  phone: string;
  buyerName: string;
  orderNumber: string;
  items: ReceiptItem[];
  total: number;
  shippingCost: number;
}): string {
  const { phone, buyerName, orderNumber, items, total, shippingCost } = params;

  const normalizedPhone = phone.replace(/\D/g, '');
  const subtotal = items.reduce((s, i) => s + i.price, 0);

  const itemLines = items
    .map((i) => `• ${i.title} — ${formatPrice(i.price)}`)
    .join('\n');

  const deliveryMethod = shippingCost === 0 ? 'Recogida en Taller' : 'Envío a domicilio';
  const deliveryCostLabel = shippingCost === 0 ? 'Gratis' : formatPrice(shippingCost);

  const message = [
    `🏎️ *MiniEngines Creations — Resguardo de pedido*`,
    ``,
    `¡Hola ${buyerName}! Gracias por tu compra 🧡`,
    ``,
    `*Pedido:* ${orderNumber}`,
    ``,
    `*Artículos:*`,
    itemLines,
    ``,
    `*Subtotal artículos:* ${formatPrice(subtotal)}`,
    `*Entrega:* ${deliveryMethod} (${deliveryCostLabel})`,
    `*Total cobrado:* ${formatPrice(total)}`,
    ``,
    shippingCost === 0
      ? `📍 Nos pondremos en contacto contigo para coordinar la recogida en nuestro taller (León, ESP).`
      : `📦 El paquete será protegido con el máximo mimo y te contactaremos antes de enviarlo.`,
    ``,
    `¡Hasta pronto! — Equipo MEC`,
  ].join('\n');

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
