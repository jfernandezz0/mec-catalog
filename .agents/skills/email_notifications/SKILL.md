---
name: email-notifications
description: Architecture, template standards, and delivery guidelines for transactional emails, receipts, and abandoned cart recovery.
---

# Transactional Email & Notifications Skill

This skill guides agents in designing, maintaining, and debugging transactional emails and customer notifications in the MEC Catalog application.

## 1. Provider Architecture & Credentials

Email delivery is orchestrated in `src/lib/email.ts` using a resilient hybrid pattern:

| Variable | Provider | Purpose |
| :--- | :--- | :--- |
| `RESEND_API_KEY` | Resend | High-deliverability transactional API for order receipts and cart recovery |
| `EMAIL_USER` | Nodemailer (Gmail SMTP) | Primary or fallback SMTP transport user |
| `EMAIL_PASS` | Nodemailer (App Password) | Gmail 16-character App Password (not standard account password) |
| `ADMIN_EMAIL` | Internal | Destination address for internal new-order and low-stock alerts |

> [!NOTE]
> **Graceful Degradation en Desarrollo**:
> Si las credenciales no están configuradas en `.env.local`, el sistema no debe abortar la compra del cliente. En su lugar, emite un aviso en consola (`console.warn`) e imprime el resumen para permitir la prueba del flujo de checkout en entornos locales.

---

## 2. Core Transactional Pipelines

MEC Catalog implementa tres flujos principales de notificación:

### A. Recibo de Compra al Cliente (`sendReceiptEmail`)
- **Destinatario**: Email del comprador (`buyer.email`).
- **Contenido**:
  - Número de orden legible (`orderNumber`, ej. `MEC-202610-0042`).
  - Tabla desglosada de artículos con precios unitarios formateados.
  - Costes de envío, descuentos aplicados (si existen) y total final.
  - Dirección de envío completa normalizada.
  - Enlace dinámico directo para ver/descargar factura: `${baseUrl}/invoice/${saleId}`.

### B. Notificación de Nueva Venta a Administración (`sendAdminOrderEmail`)
- **Destinatario**: `ADMIN_EMAIL`.
- **Contenido**:
  - Alerta de cobro confirmado con ID de pago Square.
  - Datos de contacto del cliente (Nombre, Email, Teléfono/WhatsApp).
  - Enlace directo a WhatsApp Web (`https://wa.me/...`) preconfigurado para contactar al cliente con un solo clic.

### C. Actualización de Envío (`sendShippingEmail`)
- **Disparador**: Cambio de estado de la orden a `shipped` en el panel de administración.
- **Contenido**: Número de seguimiento y empresa de transporte (Correos, SEUR, etc.).

---

## 3. Estándares para Plantillas HTML de Email

Para asegurar máxima compatibilidad en clientes de correo (Gmail, Apple Mail, Outlook):

1. **Maquetación Basada en Tablas con Estilos en Línea**:
   - Usar `<table>`, `<tr>`, `<td>` con atributos explícitos `width`, `cellpadding="0"`, `cellspacing="0"`.
   - No usar clases CSS externas ni selectores complejos de `<style>` que los clientes web suelen eliminar.
   - Usar colores seguros y contrastes legibles (`#222222` para texto, `#000000` o color de marca para botones).

2. **Sanitización de Datos de Usuario (Prevención de Inyección HTML)**:
   - Todo campo proveniente de inputs de usuario (`buyerName`, `buyerAddress`, `notes`, títulos de artículos) **debe** pasar por `escapeHtml()` antes de interpolarse en el string HTML:
   ```typescript
   function escapeHtml(value: string | null | undefined): string {
     if (!value) return '';
     return String(value)
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#39;');
   }
   ```

3. **Construcción de URLs Base Dinámicas**:
   - Utilizar el `baseUrl` pasado desde el contexto de la solicitud (`https://${request.headers.get('host')}`) o `NEXT_PUBLIC_BASE_URL` para que los enlaces nunca apunten a `http://localhost:3000` en producción.

---

## 4. Fase 8: Recuperación de Carritos Abandonados (Roadmap)

Al implementar el worker o cron de recuperación:
- Consultar `cart_sessions` vinculadas a usuarios registrados inactivas por más de 2 horas.
- Incluir botón de acción directa (CTA) `"Completar mi pedido"` con los artículos persistidos.
- Marcar la columna `abandoned_email_sent_at = NOW()` para garantizar que un cliente nunca reciba más de un recordatorio por carrito.
