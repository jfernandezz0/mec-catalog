import { getSupabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';
import styles from './invoice.module.css';
import PrintButton from './PrintButton';
import { ShippingAddress, Sale, SaleItem } from '@/lib/types';

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
  } catch {
    return isoString;
  }
}

export default async function InvoicePage(props: Props) {
  const { id } = await props.params;

  let sale: Sale | null = null;
  let saleItems: Array<SaleItem & { articles: { image_urls: string[] | null } | null }> = [];
  let shippingCost = 0;
  let shippingLabel = '';
  let subtotal = 0;
  let fetchError: string | null = null;

  try {
    const adminDb = getSupabaseAdmin();

    // 1. Fetch sale data securely using admin client (bypasses RLS)
    const { data: fetchedSale, error: saleErr } = await adminDb
      .from('sales')
      .select('*')
      .eq('id', id)
      .single();

    if (saleErr || !fetchedSale) {
      console.error('Error loading sale:', saleErr);
      throw new Error('No se encontró la venta o factura especificada.');
    }
    sale = fetchedSale as Sale;

    // 2. Fetch sale items data securely using admin client
    const { data: items, error: itemsErr } = await adminDb
      .from('sale_items')
      .select('*, articles(image_urls)')
      .eq('sale_id', id);

    if (itemsErr) {
      console.error('Error loading sale items:', itemsErr);
      throw new Error('Error al recuperar los productos vinculados a la venta.');
    }

    saleItems = (items ?? []) as Array<SaleItem & { articles: { image_urls: string[] | null } | null }>;
    const shippingInfo = sale.shipping_address as ShippingAddress | null;
    shippingCost = shippingInfo?.price ?? 0;
    shippingLabel = shippingInfo?.description || (shippingInfo?.method === 'recogida' ? 'Recogida en taller' : 'Envío Peninsular');
    subtotal = Number(sale.total_price) - Number(shippingCost);
  } catch (err: unknown) {
    fetchError = err instanceof Error ? err.message : 'No se pudo cargar la información de la venta.';
  }

  if (fetchError || !sale) {
    return (
      <div className={styles.error}>
        <h1 className={styles.errorTitle}>Error al cargar la factura</h1>
        <p>{fetchError || 'No se pudo cargar la información de la venta.'}</p>
        <Link href="/" className={styles.backLink}>
          Volver a la tienda
        </Link>
      </div>
    );
  }

  return (
    <main className={styles.container}>
      <div className={styles.invoiceCard}>
        {/* Invoice Header */}
        <header className={styles.header}>
          <div className={styles.brand}>
            <Image 
              src="/logo.png" 
              alt="MiniEngines Creations" 
              width={240}
              height={68}
              priority
              className={styles.brandLogo} 
            />
          </div>
          <div className={styles.invoiceInfo}>
            <h1 className={styles.invoiceTitle}>RECIBO DE VENTA</h1>
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
              <p><strong>Método de pago:</strong> {sale.payment_type === 'SQUARE' ? 'Pago con tarjeta' : sale.payment_type}</p>
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
                    {sale.payment_type === 'RESERVA' ? 'RESERVA PAGADA' : 'PAGADO'}
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
              {saleItems.map((item) => (
                <tr key={item.id}>
                  <td className={styles.td}>
                    <div className={styles.articleDescContainer}>
                      {item.articles?.image_urls?.[0] ? (
                        <Image 
                          src={item.articles.image_urls[0]} 
                          alt={item.title} 
                          width={44}
                          height={44}
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
            <span>Subtotal artículos:</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Gastos de envío ({shippingLabel}):</span>
            <span>{shippingCost === 0 ? 'Gratis' : formatPrice(shippingCost)}</span>
          </div>
          <div className={styles.totalRow} style={{ marginTop: '8px', borderTop: '1px dashed var(--border-card-glass)' }}>
            <span>TOTAL RECIBO:</span>
            <span>{formatPrice(sale.total_price)}</span>
          </div>
        </footer>
      </div>

      {/* Action panel (Hidden on Print) */}
      <PrintButton />
    </main>
  );
}
