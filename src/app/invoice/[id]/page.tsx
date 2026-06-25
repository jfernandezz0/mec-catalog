'use client';

import { use, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { PrintIcon, WhatsAppIcon, TelegramIcon, EmailIcon } from '@/app/components/Icons';
import styles from './invoice.module.css';

type Props = {
  params: Promise<{ id: string }>;
};



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
          .select('*, articles(image_urls)')
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
            <img 
              src="/logo.png" 
              alt="MiniEngines Creations" 
              className={styles.brandLogo} 
            />
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
                    {sale.payment_type === 'RESERVA' ? 'RESERVADO (Pendiente de pago)' : 'PRECOMPRA (Pendiente de envío)'}
                  </span>
                </p>
              )}
              {sale.status === 'COMPLETADA' && (
                <p>
                  <strong>Estado:</strong>{' '}
                  <span className={`${styles.badge} ${styles.badgeAvailable}`}>
                    {sale.payment_type === 'RESERVA' ? 'RESERVA COMPLETADA' : 'COMPLETADA / ENTREGADA'}
                  </span>
                </p>
              )}
              {sale.status === 'CANCELADA' && (
                <p>
                  <strong>Estado:</strong>{' '}
                  <span className={`${styles.badge} ${styles.badgePrepurchase}`}>
                    CANCELADA / DEVUELTA
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
                    <div className={styles.articleDescContainer}>
                      {item.articles?.image_urls?.[0] ? (
                        <img 
                          src={item.articles.image_urls[0]} 
                          alt={item.title} 
                          className={styles.articleThumb} 
                        />
                      ) : (
                        <div className={styles.articleThumbPlaceholder}>📦</div>
                      )}
                      <div>
                        <strong>{item.title}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          ID Ref: MEC-{String(item.article_id).padStart(4, '0')}
                        </div>
                      </div>
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
                        {sale.payment_type === 'RESERVA' ? 'Reservado*' : 'Precompra*'}
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
          <PrintIcon width="18" height="18" aria-hidden="true" />
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
            <WhatsAppIcon className={`${styles.iconSmall} ${styles.whatsapp}`} width="18" height="18" />
          </a>
          <a
            href={telegramShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.shareBtn}
            title="Compartir por Telegram"
          >
            <TelegramIcon className={`${styles.iconSmall} ${styles.telegram}`} width="18" height="18" />
          </a>
          <a
            href={emailShareUrl}
            className={styles.shareBtn}
            title="Compartir por Email"
          >
            <EmailIcon className={`${styles.iconSmall} ${styles.email}`} width="18" height="18" />
          </a>
        </div>
      </div>
    </main>
  );
}
