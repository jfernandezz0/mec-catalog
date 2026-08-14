import nodemailer from 'nodemailer';

interface ReceiptItem {
  title: string;
  price: number;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  const isConfigured = user && pass && pass !== 'tu_contrasena_de_aplicacion_aqui';

  if (!isConfigured) {
    console.warn(
      '[nodemailer] Warning: Gmail SMTP credentials are not configured in .env.local. Emails will be logged to console only.',
    );
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });
}

function buildReceiptHtml(
  orderNumber: string,
  buyerName: string,
  items: ReceiptItem[],
  total: number,
  paymentMethod: string,
  shippingMethodLabel: string,
  shippingCost: number,
  saleId: string,
  baseUrl: string,
  isReservation: boolean = false,
): string {
  const itemRows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222;">${i.title}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222;text-align:right;white-space:nowrap;">${formatPrice(i.price)}</td>
      </tr>`,
    )
    .join('');

  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const invoiceUrl = `${baseUrl}/invoice/${saleId}`;

  const headerTitle = isReservation ? 'Resguardo de reserva' : 'Resguardo de pedido';
  const introText = isReservation
    ? 'Gracias por tu reserva. A continuación encontrarás el resumen de los artículos seleccionados.'
    : 'Gracias por tu compra. A continuación encontrarás el resumen de tu pedido.';
  const totalLabel = isReservation ? 'Total pendiente de validación' : 'Total final cobrado';
  
  const reservationNotice = isReservation
    ? `<div style="margin-top:12px;background:rgba(255,255,255,0.15);border:1px dashed rgba(255,255,255,0.3);border-radius:8px;padding:8px 12px;display:inline-block;">
        <p style="margin:0;font-size:13px;color:#ffffff;font-weight:600;line-height:1.4;">
          Una vez confirmado el pago recibirás un nuevo correo con la confirmación.
        </p>
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 32px 28px;text-align:center;">
            <p style="margin:0;font-size:13px;font-weight:600;color:rgba(255,255,255,0.8);letter-spacing:0.08em;text-transform:uppercase;">MiniEngines Creations</p>
            <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;color:#ffffff;">${headerTitle}</h1>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">${orderNumber}</p>
            ${reservationNotice}
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0;font-size:16px;color:#333;">Hola <strong>${buyerName}</strong>,</p>
            <p style="margin:10px 0 0;font-size:14px;color:#666;line-height:1.6;">
              ${introText}
            </p>
          </td>
        </tr>

        <!-- Items table -->
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f8f8f8;">
                  <th style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#999;text-align:left;">Artículo</th>
                  <th style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#999;text-align:right;">Precio</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Total -->
        <tr>
          <td style="padding:16px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#666;padding:8px 0;">Subtotal artículos</td>
                <td style="font-size:14px;color:#333;font-weight:600;text-align:right;padding:8px 0;">${formatPrice(subtotal)}</td>
              </tr>
              <tr>
                <td style="font-size:14px;color:#666;padding:8px 0;">Método de entrega</td>
                <td style="font-size:14px;color:#333;font-weight:600;text-align:right;padding:8px 0;">${shippingMethodLabel}</td>
              </tr>
              <tr>
                <td style="font-size:14px;color:#666;padding:8px 0;">Coste de entrega</td>
                <td style="font-size:14px;color:#333;font-weight:600;text-align:right;padding:8px 0;">${shippingCost === 0 ? 'Gratis' : formatPrice(shippingCost)}</td>
              </tr>
              <tr>
                <td style="font-size:14px;color:#666;padding:8px 0;">Método de pago</td>
                <td style="font-size:14px;color:#333;font-weight:600;text-align:right;padding:8px 0;">${paymentMethod}</td>
              </tr>
              <tr style="border-top:2px solid #f0f0f0;">
                <td style="font-size:16px;font-weight:800;color:#222;padding:12px 0;">${totalLabel}</td>
                <td style="font-size:18px;font-weight:800;color:#6366f1;text-align:right;padding:12px 0;">${formatPrice(total)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Button to Online Invoice -->
        <tr>
          <td style="padding:20px 32px 10px;text-align:center;">
            <a href="${invoiceUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 12px rgba(99,102,241,0.25);">
              Ver Factura Online / PDF 📄
            </a>
          </td>
        </tr>

        <!-- Shipping note -->
        <tr>
          <td style="padding:10px 32px 16px;">
            ${
              shippingCost === 0
                ? `<div style="background:#d1fae5;border:1px solid #10b981;border-radius:10px;padding:14px 16px;">
                    <p style="margin:0;font-size:13px;color:#065f46;line-height:1.5;">
                      📍 <strong>Recogida en taller (León):</strong> Nos pondremos en contacto contigo para acordar la fecha y hora de la recogida.
                    </p>
                  </div>`
                : `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;">
                    <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
                      🚚 <strong>Envío a domicilio:</strong> El paquete se protegerá con el máximo mimo y nos pondremos en contacto contigo antes de realizar el envío.
                    </p>
                  </div>`
            }
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 32px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.6;text-align:center;">
              ¿Tienes alguna pregunta? Escríbenos a
              <a href="mailto:minienginescreations@gmail.com" style="color:#6366f1;">minienginescreations@gmail.com</a>
              <br>© ${new Date().getFullYear()} MiniEngines Creations — Todos los derechos reservados
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Send purchase receipt to buyer */
export async function sendReceiptEmail(params: {
  to: string;
  buyerName: string;
  orderNumber: string;
  items: ReceiptItem[];
  total: number;
  paymentMethod: string;
  shippingMethodLabel: string;
  shippingCost: number;
  saleId: string;
  baseUrl: string;
  isReservation?: boolean;
}) {
  const { to, buyerName, orderNumber, items, total, paymentMethod, shippingMethodLabel, shippingCost, saleId, baseUrl, isReservation = false } = params;

  const transporter = getTransporter();
  const html = buildReceiptHtml(orderNumber, buyerName, items, total, paymentMethod, shippingMethodLabel, shippingCost, saleId, baseUrl, isReservation);

  const emailSubject = isReservation
    ? `Resguardo de reserva ${orderNumber} — MiniEngines Creations`
    : `Resguardo de pedido ${orderNumber} — MiniEngines Creations`;

  if (!transporter) {
    console.log(`\n--- SIMULATED RECEIPT EMAIL FOR CLIENT (${to}) ---`);
    console.log(`Subject: ${emailSubject}`);
    console.log(`From: minienginescreations@gmail.com`);
    console.log(`Total: ${formatPrice(total)}`);
    console.log(`Link: ${baseUrl}/invoice/${saleId}`);
    console.log('--------------------------------------------------\n');
    return;
  }

  try {
    await transporter.sendMail({
      from: `"MiniEngines Creations" <${process.env.EMAIL_USER}>`,
      to,
      subject: emailSubject,
      html,
    });
    console.log(`[nodemailer] Receipt email sent successfully to ${to}`);
  } catch (err: any) {
    console.error('[nodemailer] Failed to send receipt email:', err);
    throw new Error(`Email send failed: ${err.message}`);
  }
}

/** Send order notification to admin */
export async function sendAdminOrderEmail(params: {
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerWhatsapp?: string | null;
  items: ReceiptItem[];
  total: number;
  shippingAddress?: object | null;
  paymentMethod: string;
}) {
  const {
    orderNumber,
    buyerName,
    buyerEmail,
    buyerWhatsapp,
    items,
    total,
    shippingAddress,
    paymentMethod,
  } = params;

  const adminEmail = process.env.ADMIN_EMAIL || 'minienginescreations@gmail.com';
  const itemList = items.map((i) => `• ${i.title} — ${formatPrice(i.price)}`).join('\n');

  // Format delivery/shipping address elegantly as text
  const shippingInfo = shippingAddress as any;
  let deliverySectionHtml = '';

  if (shippingInfo) {
    if (shippingInfo.method === 'recogida') {
      deliverySectionHtml = `
        <div style="background:#f9fafb;padding:16px;border-radius:10px;border:1px solid #e5e7eb;margin-top:10px;">
          <p style="margin:0 0 6px 0;font-size:14px;color:#111827;"><strong>Método:</strong> 🚗 Recogida en Taller (León)</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">Contactar con el comprador para acordar fecha/hora de recogida.</p>
        </div>
      `;
    } else {
      deliverySectionHtml = `
        <div style="background:#f9fafb;padding:16px;border-radius:10px;border:1px solid #e5e7eb;margin-top:10px;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#111827;"><strong>Método:</strong> 📦 Envío Peninsular (Pagado: 9,99 €)</p>
          <p style="margin:0 0 4px 0;font-size:13px;color:#374151;"><strong>Dirección:</strong> ${shippingInfo.address || ''}</p>
          <p style="margin:0 0 4px 0;font-size:13px;color:#374151;"><strong>Código Postal:</strong> ${shippingInfo.postalCode || ''}</p>
          <p style="margin:0 0 4px 0;font-size:13px;color:#374151;"><strong>Localidad:</strong> ${shippingInfo.city || ''}</p>
          <p style="margin:0 0 4px 0;font-size:13px;color:#374151;"><strong>Provincia:</strong> ${shippingInfo.province || ''}</p>
          <p style="margin:0;font-size:13px;color:#374151;"><strong>País:</strong> ${shippingInfo.country || 'España'}</p>
        </div>
      `;
    }
  } else {
    deliverySectionHtml = `<p style="color:#ef4444;font-style:italic;">No especificada o venta en mano.</p>`;
  }

  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #f0f0f0;border-radius:12px;">
  <h2 style="color:#6366f1;margin-top:0;font-size:20px;border-bottom:2px solid #eef2f6;padding-bottom:12px;">🛒 Nuevo pedido online: ${orderNumber}</h2>
  
  <div style="margin-top:16px;margin-bottom:20px;">
    <h3 style="font-size:14px;text-transform:uppercase;color:#8898aa;margin-bottom:8px;letter-spacing:1px;">👤 Datos del cliente</h3>
    <p style="margin:0 0 6px 0;font-size:14px;"><strong>Nombre completo:</strong> ${buyerName}</p>
    <p style="margin:0 0 6px 0;font-size:14px;"><strong>Email:</strong> <a href="mailto:${buyerEmail}" style="color:#6366f1;text-decoration:none;">${buyerEmail}</a></p>
    ${buyerWhatsapp ? `<p style="margin:0 0 6px 0;font-size:14px;"><strong>WhatsApp / Teléfono:</strong> <a href="https://wa.me/${buyerWhatsapp.replace(/\D/g, '')}" style="color:#6366f1;text-decoration:none;">${buyerWhatsapp}</a></p>` : ''}
    <p style="margin:0;font-size:14px;"><strong>Método de pago:</strong> ${paymentMethod}</p>
  </div>

  <div style="margin-bottom:20px;">
    <h3 style="font-size:14px;text-transform:uppercase;color:#8898aa;margin-bottom:8px;letter-spacing:1px;">📦 Detalles de la entrega</h3>
    ${deliverySectionHtml}
  </div>

  <div style="margin-bottom:10px;">
    <h3 style="font-size:14px;text-transform:uppercase;color:#8898aa;margin-bottom:8px;letter-spacing:1px;">🏎️ Artículos pedidos</h3>
    <pre style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid #f1f5f9;font-family:monospace;font-size:13px;color:#334155;margin:0 0 12px 0;white-space:pre-wrap;">${itemList}</pre>
    <p style="margin:0;font-size:16px;text-align:right;"><strong>Total cobrado:</strong> <span style="color:#6366f1;font-size:18px;font-weight:bold;font-family:monospace;">${formatPrice(total)}</span></p>
  </div>

  <div style="border-top:1px solid #f0f0f0;margin-top:24px;padding-top:16px;text-align:center;">
    <p style="color:#64748b;font-size:12px;margin:0;">Este es un mensaje automático de la web MEC Catalog. Gestiona el envío o prepara la recogida contactando al comprador directamente.</p>
  </div>
</div>`;

  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n--- SIMULATED ADMIN NOTIFICATION EMAIL ---`);
    console.log(`Subject: [MEC] Nuevo pedido ${orderNumber} — ${buyerName}`);
    console.log(`To: ${adminEmail}`);
    console.log(`Total: ${formatPrice(total)}`);
    console.log('------------------------------------------\n');
    return;
  }

  try {
    await transporter.sendMail({
      from: `"MEC Catalog Alert" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `[MEC] Nuevo pedido ${orderNumber} — ${buyerName}`,
      html,
    });
    console.log('[nodemailer] Admin notification email sent successfully.');
  } catch (err: any) {
    console.error('[nodemailer] Failed to send admin notification email:', err);
  }
}
/** Send "shipped" notification to buyer */
export async function sendShippingEmail(params: {
  to: string;
  buyerName: string;
  orderNumber: string;
  items: ReceiptItem[];
  total: number;
  paymentMethod: string;
  shippingMethodLabel: string;
  shippingCost: number;
  saleId: string;
  trackingLink?: string | null;
  baseUrl: string;
}) {
  const {
    to, buyerName, orderNumber, items, total, paymentMethod,
    shippingMethodLabel, shippingCost, saleId, trackingLink, baseUrl,
  } = params;

  const itemRows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222;">${i.title}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222;text-align:right;white-space:nowrap;">${formatPrice(i.price)}</td>
      </tr>`,
    )
    .join('');

  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const invoiceUrl = `${baseUrl}/invoice/${saleId}`;

  const trackingBlock = trackingLink
    ? `
      <tr>
        <td style="padding:20px 32px 0;">
          <div style="background:#d1fae5;border:1px solid #10b981;border-radius:12px;padding:18px 20px;">
            <p style="margin:0 0 6px 0;font-size:14px;font-weight:700;color:#065f46;">🔗 Seguimiento de tu paquete</p>
            <p style="margin:0 0 10px 0;font-size:13px;color:#065f46;line-height:1.5;">
              Puedes hacer seguimiento de tu pedido en el siguiente enlace:
            </p>
            <a href="${trackingLink}" target="_blank"
               style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;font-weight:700;font-size:13px;border-radius:8px;">
              Seguir mi pedido →
            </a>
          </div>
        </td>
      </tr>`
    : `
      <tr>
        <td style="padding:20px 32px 0;">
          <div style="background:#d1fae5;border:1px solid #10b981;border-radius:12px;padding:16px 20px;">
            <p style="margin:0;font-size:13px;color:#065f46;line-height:1.5;">
              🚚 <strong>Tu pedido está en camino.</strong> Recibirás el paquete en los próximos días. Si tienes alguna duda no dudes en contactarnos.
            </p>
          </div>
        </td>
      </tr>`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#10b981,#059669);padding:32px 32px 28px;text-align:center;">
            <p style="margin:0;font-size:13px;font-weight:600;color:rgba(255,255,255,0.8);letter-spacing:0.08em;text-transform:uppercase;">MiniEngines Creations</p>
            <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;color:#ffffff;">¡Tu pedido está en camino! 🚚</h1>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">${orderNumber}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0;font-size:16px;color:#333;">Hola <strong>${buyerName}</strong>,</p>
            <p style="margin:10px 0 0;font-size:14px;color:#666;line-height:1.6;">
              Tu pedido ha sido <strong>enviado</strong> y está de camino. A continuación encontrarás el resumen.
            </p>
          </td>
        </tr>

        <!-- Tracking block -->
        ${trackingBlock}

        <!-- Items table -->
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f8f8f8;">
                  <th style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#999;text-align:left;">Artículo</th>
                  <th style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#999;text-align:right;">Precio</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Total -->
        <tr>
          <td style="padding:16px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#666;padding:8px 0;">Subtotal artículos</td>
                <td style="font-size:14px;color:#333;font-weight:600;text-align:right;padding:8px 0;">${formatPrice(subtotal)}</td>
              </tr>
              <tr>
                <td style="font-size:14px;color:#666;padding:8px 0;">Método de entrega</td>
                <td style="font-size:14px;color:#333;font-weight:600;text-align:right;padding:8px 0;">${shippingMethodLabel}</td>
              </tr>
              <tr>
                <td style="font-size:14px;color:#666;padding:8px 0;">Coste de entrega</td>
                <td style="font-size:14px;color:#333;font-weight:600;text-align:right;padding:8px 0;">${shippingCost === 0 ? 'Gratis' : formatPrice(shippingCost)}</td>
              </tr>
              <tr>
                <td style="font-size:14px;color:#666;padding:8px 0;">Método de pago</td>
                <td style="font-size:14px;color:#333;font-weight:600;text-align:right;padding:8px 0;">${paymentMethod}</td>
              </tr>
              <tr style="border-top:2px solid #f0f0f0;">
                <td style="font-size:16px;font-weight:800;color:#222;padding:12px 0;">Total facturado</td>
                <td style="font-size:18px;font-weight:800;color:#10b981;text-align:right;padding:12px 0;">${formatPrice(total)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Button to Online Invoice -->
        <tr>
          <td style="padding:20px 32px 10px;text-align:center;">
            <a href="${invoiceUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 12px rgba(99,102,241,0.25);">
              Ver Factura Online / PDF 📄
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 32px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.6;text-align:center;">
              ¿Tienes alguna pregunta? Escríbenos a
              <a href="mailto:minienginescreations@gmail.com" style="color:#6366f1;">minienginescreations@gmail.com</a>
              <br>© ${new Date().getFullYear()} MiniEngines Creations — Todos los derechos reservados
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n--- SIMULATED SHIPPING EMAIL FOR CLIENT (${to}) ---`);
    console.log(`Subject: Tu pedido ${orderNumber} está en camino 🚚 — MiniEngines Creations`);
    console.log(`Tracking: ${trackingLink || 'No proporcionado'}`);
    console.log('----------------------------------------------------\n');
    return;
  }

  try {
    await transporter.sendMail({
      from: `"MiniEngines Creations" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Tu pedido ${orderNumber} está en camino 🚚 — MiniEngines Creations`,
      html,
    });
    console.log(`[nodemailer] Shipping email sent successfully to ${to}`);
  } catch (err: any) {
    console.error('[nodemailer] Failed to send shipping email:', err);
    throw new Error(`Shipping email send failed: ${err.message}`);
  }
}
