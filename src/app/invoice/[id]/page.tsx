'use client';

import { use, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import styles from './invoice.module.css';

type Props = {
  params: Promise<{ id: string }>;
};

function formatPrice(value: number | string) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value));
}

function formatDate(isoString: string) {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch (e) {
    return isoString;
  }
}

export default function InvoicePage(props: Props) {
  const params = use(props.params);
  const id = params.id;

  const [sale, setSale] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(window.location.href);
    }
  }, []);

  useEffect(() => {
    async function fetchInvoice() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch sale data
        const { data: saleData, error: saleErr } = await supabase
          .from('sales')
          .select('*')
          .eq('id', id)
          .single();

        if (saleErr || !saleData) {
          console.error('Error loading sale:', saleErr);
          throw new Error('No se encontró la venta o factura especificada.');
        }

        // 2. Fetch sale items data
        const { data: itemsData, error: itemsErr } = await supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', id);

        if (itemsErr) {
          console.error('Error loading sale items:', itemsErr);
          throw new Error('Error al recuperar los productos vinculados a la venta.');
        }

        setSale(saleData);
        setItems(itemsData ?? []);
      } catch (err: any) {
        setError(err.message || 'Ocurrió un error al cargar la factura.');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Cargando factura...</p>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className={styles.error}>
        <h1 className={styles.errorTitle}>Error al cargar la factura</h1>
        <p>{error || 'No se pudo cargar la información de la venta.'}</p>
        <Link href="/" className={styles.backLink}>
          Volver a la tienda
        </Link>
      </div>
    );
  }

  // Pre-filled sharing details
  const sharingText = `Recibo de Venta - MiniEngines Creations (ID: ${sale.id.substring(0, 8)})`;
  const encodedText = encodeURIComponent(sharingText);
  const encodedUrl = encodeURIComponent(shareUrl);

  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent(sharingText)}&body=Hola,%20aquí%20tienes%20el%20enlace%20a%20tu%20recibo%20de%20compra%20de%20MiniEngines%20Creations:%20${encodedUrl}`;

  return (
    <main className={styles.container}>
      <div className={styles.invoiceCard}>
        {/* Invoice Header */}
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandName}>MINIENGINES CREATIONS</span>
            <span className={styles.brandSubtitle}>Catálogo Exclusivo de Modelismo</span>
          </div>
          <div className={styles.invoiceInfo}>
            <h1 className={styles.invoiceTitle}>FACTURA / RECIBO</h1>
            <div className={styles.invoiceMeta}>
              <p><strong>Nº:</strong> MEC-{sale.id.substring(0, 8).toUpperCase()}</p>
              <p><strong>Fecha:</strong> {formatDate(sale.created_at)}</p>
            </div>
          </div>
        </header>

        {/* Invoice details grid */}
        <section className={styles.detailsGrid}>
          <div className={styles.detailBlock}>
            <h2 className={styles.blockTitle}>Comprador</h2>
            <div className={styles.blockText}>
              {sale.buyer_email || sale.buyer_phone ? (
                <>
                  {sale.buyer_email && <p><strong>Email:</strong> {sale.buyer_email}</p>}
                  {sale.buyer_phone && <p><strong>Teléfono:</strong> {sale.buyer_phone}</p>}
                </>
              ) : (
                <p>Cliente no registrado (Venta directa)</p>
              )}
            </div>
          </div>
          <div className={styles.detailBlock}>
            <h2 className={styles.blockTitle}>Detalle del Pago y Envío</h2>
            <div className={styles.blockText}>
              <p><strong>Método de pago:</strong> {sale.payment_type}</p>
              <p><strong>Lugar de venta:</strong> {sale.location || 'online'}</p>
              {sale.status === 'PRECOMPRA' && (
                <p>
                  <strong>Estado:</strong>{' '}
                  <span className={`${styles.badge} ${styles.badgePrepurchase}`}>
                    PRECOMPRA (Pendiente de envío)
                  </span>
                </p>
              )}
              {sale.status === 'COMPLETADA' && (
                <p>
                  <strong>Estado:</strong>{' '}
                  <span className={`${styles.badge} ${styles.badgeAvailable}`}>
                    COMPLETADA / ENTREGADA
                  </span>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Table items */}
        <section className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Descripción del Artículo</th>
                <th className={`${styles.th} ${styles.alignCenter}`}>Unidades</th>
                <th className={`${styles.th} ${styles.alignRight}`}>Precio Unitario</th>
                <th className={`${styles.th} ${styles.alignRight}`}>Total</th>
                <th className={`${styles.th} ${styles.alignCenter} noPrint`}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className={styles.td}>
                    <strong>{item.title}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      ID Ref: MEC-{String(item.article_id).padStart(4, '0')}
                    </div>
                  </td>
                  <td className={`${styles.td} ${styles.alignCenter}`}>
                    {item.quantity}
                  </td>
                  <td className={`${styles.td} ${styles.price}`}>
                    {formatPrice(item.price)}
                  </td>
                  <td className={`${styles.td} ${styles.price}`}>
                    {formatPrice(Number(item.price) * item.quantity)}
                  </td>
                  <td className={`${styles.td} ${styles.alignCenter} noPrint`}>
                    {item.is_prepurchase ? (
                      <span className={`${styles.badge} ${styles.badgePrepurchase}`}>
                        Precompra*
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeAvailable}`}>
                        Disponible
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totals Summary */}
        <footer className={styles.summarySection}>
          <div className={styles.summaryRow}>
            <span>Total artículos:</span>
            <span>{sale.total_articles} uds.</span>
          </div>
          <div className={styles.totalRow}>
            <span>TOTAL FACTURA:</span>
            <span>{formatPrice(sale.total_price)}</span>
          </div>
        </footer>
      </div>

      {/* Action panel (Hidden on Print) */}
      <div className={`${styles.actions} noPrint`}>
        <button onClick={handlePrint} className={`${styles.button} ${styles.primaryButton}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Descargar PDF / Imprimir
        </button>

        <div className={styles.shareSection}>
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.shareBtn}
            title="Compartir por WhatsApp"
          >
            <svg className={`${styles.iconSmall} ${styles.whatsapp}`} width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.46h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>
          <a
            href={telegramShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.shareBtn}
            title="Compartir por Telegram"
          >
            <svg className={`${styles.iconSmall} ${styles.telegram}`} width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.6 1.5-1.55 2.75-2.92 2.86-3.44.02-.1-.01-.15-.07-.17-.06-.02-.15-.01-.22.01-.1.02-1.7 1.08-4.8 3.16-.45.31-.87.47-1.25.46-.42-.01-1.23-.24-1.83-.43-.74-.24-1.33-.37-1.28-.79.03-.22.33-.45.9-.69 3.53-1.53 5.88-2.54 7.07-3.03 3.37-1.4 4.07-1.64 4.53-1.65.1 0 .32.02.47.14.12.1.16.24.18.33.02.1.03.27.02.35z" />
            </svg>
          </a>
          <a
            href={emailShareUrl}
            className={styles.shareBtn}
            title="Compartir por Email"
          >
            <svg className={`${styles.iconSmall} ${styles.email}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </a>
        </div>
      </div>
    </main>
  );
}
