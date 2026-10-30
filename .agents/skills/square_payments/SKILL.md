---
name: square-payments
description: Playbook and security guidelines for Square payment processing, stock reservation lifecycle, and webhook verification.
---

# Square Payments & Stock Lifecycle Skill

This skill guides agents in maintaining, debugging, and extending the payment gateway, stock reservations, and webhook processing in the MEC Catalog application.

## 1. Architecture & Credentials

The application uses the official `square` npm SDK (`SquareClient`).
All configuration resides in `src/lib/square.ts` and relies on these environment variables:

| Variable | Scope | Purpose |
| :--- | :--- | :--- |
| `SQUARE_ACCESS_TOKEN` | Server | Production or Sandbox access token |
| `SQUARE_LOCATION_ID` | Server | Location ID associated with the merchant account |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Server | Secret key used to verify Square HMAC-SHA256 signatures |
| `SQUARE_ENVIRONMENT` | Server | `'sandbox'` or `'production'` |
| `NEXT_PUBLIC_SQUARE_APPLICATION_ID` | Client | App ID used by Square Web Payments SDK iframe |
| `NEXT_PUBLIC_SQUARE_ENVIRONMENT` | Client | Environment flag passed to frontend payment forms |

> [!CAUTION]
> **Never expose secrets**: `SQUARE_ACCESS_TOKEN` and `SQUARE_WEBHOOK_SIGNATURE_KEY` must never be referenced in client components or returned in API response bodies.

---

## 2. The Checkout & Stock Reservation Lifecycle

Payment processing follows a strict 5-step transactional flow:

```
[Cliente Checkout]
       │
       ▼
 1. /api/checkout/reserve-stock
       │  (Bloquea stock por 3 minutos vía RPC reserve_article_stock)
       ▼
 2. /api/checkout/create-payment
       │  (Crea sesión en pending_checkouts y llama a squareClient.paymentsApi.createPayment)
       ├─ Éxito ──► 3. createSaleFromPayment (Sincrónico: crea orden, descuenta stock, envía email)
       │                 │
       │                 ▼
       │            4. Elimina registro de pending_checkouts
       │
       └─ Error ──► 5. /api/checkout/release-stock (Libera artículos reservados si la tarjeta falla)
```

### Reglas críticas de Stock:
1. **Atómicidad en Reserva**: Se intenta primero mediante la función RPC `reserve_article_stock` con bloqueo de 3 minutos (`reserved_until`). Si la RPC falla, se recurre a `UPDATE articles SET reserved_until = ... WHERE id = ... AND quantity > 0`.
2. **Reversión Obligatoria**: Si el pago es rechazado (error 4xx de tarjeta rechazada), se debe limpiar la sesión pendiente y liberar el stock reservado inmediatamente.

### Manejo de Montos (Square Money Object):
- Square espera montos en céntimos como `BigInt`:
  ```typescript
  amountMoney: {
    amount: BigInt(Math.round(totalAmountInEuros * 100)),
    currency: 'EUR',
  }
  ```
- No redondear después de multiplicar por 100 sin `Math.round()` para evitar problemas con números de punto flotante en JavaScript.

---

## 3. Webhook Verification & Asynchronous Fallback

Ruta: `src/app/api/webhooks/square/route.ts`

El webhook actúa como **mecanismo de redundancia** si el usuario cierra el navegador antes de que `/api/checkout/create-payment` termine de registrar la venta:

1. **Verificación Criptográfica Obligatoria**:
   - Cada solicitud entrante contiene la cabecera `x-square-hmacsha256-signature`.
   - La función `verifySquareWebhookSignature` calcula el HMAC-SHA256 del cuerpo crudo (`rawBody`) concatenado con la URL de notificación.
   - Debe usar `crypto.timingSafeEqual` para evitar ataques de tiempo (*timing attacks*).

2. **Idempotencia**:
   - Comprobar siempre si la venta asociada a `payment.id` ya fue registrada previamente en la base de datos para no duplicar ventas ni descontar stock dos veces.
   - Responder siempre `200 OK` a Square tras procesar o descartar el evento para evitar reintentos continuos de Square.

---

## 4. Pruebas y Sandbox

- **Tarjetas de Prueba**: En entorno `sandbox`, usar las tarjetas oficiales de Square documentadas (ej. tarjetas que simulan `APPROVED`, `GENERIC_DECLINE`, `CVV_FAILURE`).
- **Verificación Local de Webhooks**: Al probar webhooks localmente, emular la cabecera o utilizar la CLI de Square / túnel con URL fija en `SQUARE_WEBHOOK_URL`.
