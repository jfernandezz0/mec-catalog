import type { Metadata } from 'next';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Pedido confirmado | MiniEngines Creations',
  description: 'Tu pedido ha sido confirmado correctamente.',
  robots: { index: false },
};

interface ShippingAddressJson {
  method?: string;
  [key: string]: any;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber = '' } = await searchParams;

  let isPickup = false;
  let isManualPayment = false;

  if (orderNumber) {
    try {
      const db = getSupabaseAdmin();
      const { data: sale } = await db
        .from('sales')
        .select('shipping_address, payment_type')
        .eq('order_number', orderNumber)
        .maybeSingle();

      const shippingInfo = sale?.shipping_address as ShippingAddressJson | null;
      if (shippingInfo?.method === 'recogida') {
        isPickup = true;
      }
      if (sale?.payment_type === 'BIZUM' || sale?.payment_type === 'PAYPAL') {
        isManualPayment = true;
      }
    } catch (err) {
      console.error('[CheckoutSuccessPage] Error checking delivery method:', err);
    }
  }

  // Pre-filled social links (matching share configuration)
  const contactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE || '34619148601';
  const whatsappUrl = `https://wa.me/${contactPhone}`;
  const instagramUrl = 'https://www.instagram.com/minienginescreations?igsh=MWRkMXpwYXJma2ZmYw%3D%3D&utm_source=qr';

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
      }}
    >
      <div style={{ maxWidth: '520px', width: '100%', textAlign: 'center' }}>

        {/* Success icon */}
        <div
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: '0 8px 32px rgba(16,185,129,0.4)',
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: '28px',
            fontWeight: 800,
            marginBottom: '8px',
            letterSpacing: '-0.02em',
          }}
        >
          {isManualPayment ? '¡Pedido reservado! 🕒' : '¡Pedido confirmado! 🎉'}
        </h1>

        {orderNumber && (
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              marginBottom: '4px',
            }}
          >
            Número de pedido:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{orderNumber}</strong>
          </p>
        )}

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '15px',
            lineHeight: 1.7,
            marginBottom: '28px',
            marginTop: '16px',
          }}
        >
          {isManualPayment ? (
            <>
              Recibirás una confirmación vía email o whatsapp cuando recibamos el pago, puede tardar hasta 24/48 horas. Si hubiera algún problema nos pondremos en contacto.
            </>
          ) : (
            <>Gracias por tu compra. Recibirás el resguardo en tu email en breve.</>
          )}
        </p>

        {/* Info cards */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginBottom: '32px',
          }}
        >
          <InfoCard 
            icon="📧" 
            text="Hemos enviado el resguardo al email proporcionado." 
          />
          <InfoCard
            icon="📦"
            text={
              isPickup
                ? 'Nos pondremos en contacto para acordar fecha/hora de recogida en menos de 24/48 horas.'
                : 'El envío se efectuará en un máximo de 72 horas por Correos certificado a la dirección indicada. Si hubiera alguna incidencia nos pondríamos en contacto directamente.'
            }
          />
          <InfoCard
            icon="💬"
            text={
              <span>
                Si tienes cualquier duda, escríbenos a{' '}
                <a href="mailto:minienginescreations@gmail.com" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                  minienginescreations@gmail.com
                </a>
                , vía{' '}
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', textDecoration: 'underline', fontWeight: 'bold' }}>
                  WhatsApp
                </a>{' '}
                o vía{' '}
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#E1306C', textDecoration: 'underline', fontWeight: 'bold' }}>
                  Instagram
                </a>.
              </span>
            }
          />
        </div>

        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '13px 32px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '15px',
            boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
          }}
        >
          ← Volver al catálogo
        </Link>
      </div>
    </main>
  );
}

function InfoCard({ icon, text }: { icon: string; text: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        background: 'var(--bg-card-glass)',
        border: '1px solid var(--border-card)',
        borderRadius: '10px',
        textAlign: 'left',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: '20px', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>{text}</div>
    </div>
  );
}
