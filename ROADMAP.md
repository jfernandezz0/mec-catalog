# MEC Catalog — Roadmap de Integración y Futuras Fases

Este documento define la planificación técnica de las siguientes fases de desarrollo acordadas para mejorar la seguridad, control y la experiencia de usuario.

---

## 🔲 Fase 8 — Registro de Usuarios, Cupones y Carritos Abandonados

Esta fase introduce el portal de clientes, la persistencia de datos del comprador y la recuperación de ventas.

### 1. Autenticación y Cuentas (Supabase Auth)
- **Inicio de sesión**: Implementación de Supabase Auth en el frontend mediante Magic Link (sin contraseña) y/o email y contraseña.
- **Área de Cliente**: Página de perfil `/perfil` que liste el historial de pedidos completados y estado de envíos en tiempo real directamente desde Supabase.
- **Autocompletado**: Si el usuario está autenticado, rellenar automáticamente los campos de contacto y envío en el checkout.

### 2. Persistencia y Fusión del Carrito
- **Persistencia en Base de Datos**: Crear tabla `cart_sessions` vinculada a `user_id`.
- **Lógica de Fusión (Merge)**: Al iniciar sesión, fusionar los artículos del `localStorage` anónimo con el carrito de la base de datos, eliminando duplicados y volviendo a validar el stock disponible.

### 3. Cupones de Descuento
- **Tabla `coupons`**: Atributos: `code` (único, ej. `MEC10`), `type` (`FIXED` o `PERCENT`), `value` (descuento), `expires_at`, `max_uses`, `uses_count`.
- **Checkout**: Integrar campo de código promocional en el carrito y en el proceso de pago.
- **Validación Backend**: Endpoint seguro `/api/checkout/validate-coupon` que recalcule los totales en el servidor y prevenga la manipulación de precios antes de enviar a Square o registrar en Bizum.

### 4. Recuperación de Carritos Abandonados (Solo Registrados)
- **Definición**: Si un usuario registrado añade artículos al carrito y no completa el checkout tras 2 horas de inactividad, se disparará una alerta.
- **Automatización**: Una tarea programada (cron) buscará estas sesiones en `cart_sessions` y enviará un email con Resend conteniendo el resumen de sus artículos y un enlace directo de pago rápido para recuperar el pedido.

---

## 🔲 Fase 9 — Optimización de Imágenes en Catálogo (WebP)

Esta fase optimiza el tiempo de carga y el uso de almacenamiento.

### 1. Compresión Automática en Subidas
- **Procesamiento**: Al subir logos de categoría o imágenes de artículos desde el Panel de Administración, la API de Next.js procesará el archivo en el backend.
- **Conversión a WebP**: Se comprimirá la imagen al formato WebP (reduciendo hasta un 70% el peso sin pérdida visual de calidad) antes de subir el archivo al bucket de Supabase Storage.
- **Fallback**: Si falla el procesamiento en el servidor, se subirá el archivo original para no bloquear el flujo del panel.
