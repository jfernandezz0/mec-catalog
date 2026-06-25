'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import { Sale, SaleItem, Article } from '@/lib/types';
import { WhatsAppIcon, TelegramIcon, EmailIcon } from '@/app/components/Icons';
import styles from '../admin.module.css';

interface SalesTabProps {
  articles: Article[];
  loadArticles: () => Promise<void>;
}

export default function SalesTab({ articles, loadArticles }: SalesTabProps) {
  // States
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [salesSubmenu, setSalesSubmenu] = useState<'all' | 'prepurchase' | 'completed'>('all');
  const [salesSearch, setSalesSearch] = useState('');
  const [salesFilterPayment, setSalesFilterPayment] = useState<'all' | 'REVOLUT' | 'PAYPAL' | 'EFECTIVO' | 'RESERVA'>('all');
  const [salesFilterStatus, setSalesFilterStatus] = useState<'all' | 'COMPLETADA' | 'PRECOMPRA'>('all');
  const [salesFilterDate, setSalesFilterDate] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [exportingSales, setExportingSales] = useState(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [saleDetailItems, setSaleDetailItems] = useState<SaleItem[]>([]);
  const [loadingSaleItems, setLoadingSaleItems] = useState(false);

  // Load sales on mount
  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    setLoadingSales(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading sales:', error);
      } else {
        setSales(data ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSales(false);
    }
  }

  async function handleExportSalesCSV(filteredSalesList: Sale[]) {
    if (filteredSalesList.length === 0) {
      alert('No hay ventas para exportar.');
      return;
    }
    setExportingSales(true);
    try {
      const saleIds = filteredSalesList.map((s) => s.id);
      
      const { data: allItems, error } = await supabase
        .from('sale_items')
        .select('*')
        .in('sale_id', saleIds);

      if (error) {
        throw new Error(`Error al cargar los artículos de las ventas: ${error.message}`);
      }

      const itemsBySale = new Map<string, SaleItem[]>();
      (allItems ?? []).forEach((item) => {
        const list = itemsBySale.get(item.sale_id) || [];
        list.push(item);
        itemsBySale.set(item.sale_id, list);
      });

      const csvHeaders = [
        'ID Venta',
        'Fecha',
        'Email Comprador',
        'Teléfono Comprador',
        'Instagram Comprador',
        'Lugar',
        'Método de Pago',
        'Total Artículos',
        'Monto Total (€)',
        'Estado',
        'Detalle Artículos'
      ];

      const csvRowsList = [csvHeaders.join(';')];

      filteredSalesList.forEach((sale) => {
        const dateStr = new Date(sale.created_at).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const email = sale.buyer_email || 'Directa';
        const phone = sale.buyer_phone || '';
        const instagram = sale.buyer_instagram || '';
        const location = sale.location || '';
        const payment = sale.payment_type || '';
        const totalQty = sale.total_articles || 0;
        const totalVal = String(sale.total_price).replace('.', ',');
        const status = sale.status || '';

        const saleItems = itemsBySale.get(sale.id) || [];
        const itemsDetail = saleItems
          .map((item) => `${item.title} (x${item.quantity}) - ${String(item.price).replace('.', ',')}€`)
          .join(' | ');

        const row = [
          sale.id.substring(0, 8).toUpperCase(),
          dateStr,
          email,
          phone,
          instagram,
          location,
          payment,
          totalQty,
          totalVal,
          status,
          `"${itemsDetail.replace(/"/g, '""')}"`
        ];

        csvRowsList.push(row.join(';'));
      });

      const csvContent = '\uFEFF' + csvRowsList.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      
      const nowStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `ventas_mec_${nowStr}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || 'Error al exportar a CSV.');
    } finally {
      setExportingSales(false);
    }
  }

  async function fetchSaleItems(saleId: string) {
    setLoadingSaleItems(true);
    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (error) {
        console.error('Error fetching sale items:', error);
      } else {
        setSaleDetailItems(data ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSaleItems(false);
    }
  }

  function viewSaleDetail(sale: Sale) {
    setSelectedSaleDetail(sale);
    fetchSaleItems(sale.id);
  }

  async function completePrepurchaseItem(item: SaleItem) {
    if (!selectedSaleDetail) return;
    try {
      const { error: itemError } = await supabase
        .from('sale_items')
        .update({ is_prepurchase: false })
        .eq('id', item.id);

      if (itemError) throw itemError;

      if (selectedSaleDetail.payment_type !== 'RESERVA' && item.article_id) {
        const { data: artData } = await supabase
          .from('articles')
          .select('quantity')
          .eq('id', item.article_id)
          .single();

        const currentQty = artData ? artData.quantity : 0;

        const { error: stockError } = await supabase
          .from('articles')
          .update({ quantity: currentQty + 1 })
          .eq('id', item.article_id);

        if (stockError) {
          console.error('Error updating stock on prepurchase completion:', stockError);
        }
      }

      const updatedItems = saleDetailItems.map((it) =>
        it.id === item.id ? { ...it, is_prepurchase: false } : it
      );
      setSaleDetailItems(updatedItems);

      const anyRemainingPrepurchase = updatedItems.some((it) => it.is_prepurchase);

      if (!anyRemainingPrepurchase) {
        const { error: saleError } = await supabase
          .from('sales')
          .update({ status: 'COMPLETADA' })
          .eq('id', selectedSaleDetail.id);

        if (saleError) {
          console.error('Error updating sale status to COMPLETADA:', saleError);
        } else {
          setSelectedSaleDetail({ ...selectedSaleDetail, status: 'COMPLETADA' });
          alert('¡El artículo ha sido completado y la venta ha sido marcada como COMPLETADA!');
        }
      } else {
        alert('Artículo completado. Aún quedan otros artículos en precompra para este pedido.');
      }

      await loadSales();
      await loadArticles();
    } catch (e: any) {
      alert(`Error al completar el artículo: ${e.message || e}`);
    }
  }

  // Filtering logic
  let filteredSales = sales;
  
  if (salesSubmenu === 'prepurchase') {
    filteredSales = filteredSales.filter(s => s.status === 'PRECOMPRA');
  } else if (salesSubmenu === 'completed') {
    filteredSales = filteredSales.filter(s => s.status === 'COMPLETADA');
  }

  if (salesSearch.trim()) {
    const query = salesSearch.toLowerCase().trim();
    filteredSales = filteredSales.filter(s => 
      s.id.toLowerCase().includes(query) ||
      (s.buyer_email && s.buyer_email.toLowerCase().includes(query)) ||
      (s.buyer_phone && s.buyer_phone.toLowerCase().includes(query)) ||
      (s.buyer_instagram && s.buyer_instagram.toLowerCase().includes(query)) ||
      (s.location && s.location.toLowerCase().includes(query))
    );
  }

  if (salesFilterPayment !== 'all') {
    filteredSales = filteredSales.filter(s => s.payment_type === salesFilterPayment);
  }

  if (salesFilterStatus !== 'all') {
    filteredSales = filteredSales.filter(s => s.status === salesFilterStatus);
  }

  if (salesFilterDate !== 'all') {
    const now = new Date();
    filteredSales = filteredSales.filter(s => {
      const date = new Date(s.created_at);
      if (salesFilterDate === 'today') {
        return date.toDateString() === now.toDateString();
      } else if (salesFilterDate === 'week') {
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      } else if (salesFilterDate === 'month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }

  // Dynamic Financial Summary calculation
  const totalRevenue = filteredSales.reduce((sum, s) => {
    if (s.payment_type === 'RESERVA' && s.status === 'PRECOMPRA') {
      return sum;
    }
    return sum + Number(s.total_price);
  }, 0);
  const totalSalesCount = filteredSales.length;
  const revenueByPayment = filteredSales.reduce((acc, s) => {
    if (s.payment_type === 'RESERVA' && s.status === 'PRECOMPRA') {
      return acc;
    }
    const type = s.payment_type || 'OTRO';
    acc[type] = (acc[type] || 0) + Number(s.total_price);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={styles.salesTabContainer}>
      {/* Submenu tabs */}
      <div 
        className={styles.salesSubmenuBar}
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--border-card-glass, rgba(255,255,255,0.1))',
          paddingBottom: '12px'
        }}
      >
        <button
          type="button"
          onClick={() => setSalesSubmenu('all')}
          className={`${styles.salesSubmenuButton} ${salesSubmenu === 'all' ? styles.salesSubmenuActive : ''}`}
          style={{
            background: salesSubmenu === 'all' ? 'var(--text-primary, #fff)' : 'transparent',
            color: salesSubmenu === 'all' ? 'var(--bg-page, #000)' : 'var(--text-secondary, #888)',
            border: '1px solid transparent',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 150ms ease'
          }}
        >
          Todas las Ventas
          <span 
            className={styles.salesSubmenuCount}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 6px',
              borderRadius: '999px',
              background: salesSubmenu === 'all' ? 'rgba(0, 0, 0, 0.15)' : 'var(--border-card-glass, rgba(255,255,255,0.1))',
              color: 'inherit',
              fontSize: '11px',
              fontWeight: 800
            }}
          >
            {sales.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSalesSubmenu('prepurchase')}
          className={`${styles.salesSubmenuButton} ${salesSubmenu === 'prepurchase' ? styles.salesSubmenuActive : ''}`}
          style={{
            background: salesSubmenu === 'prepurchase' ? 'var(--text-primary, #fff)' : 'transparent',
            color: salesSubmenu === 'prepurchase' ? 'var(--bg-page, #000)' : 'var(--text-secondary, #888)',
            border: '1px solid transparent',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 150ms ease'
          }}
        >
          Precompras Pendientes
          <span 
            className={styles.salesSubmenuCount}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 6px',
              borderRadius: '999px',
              background: salesSubmenu === 'prepurchase' ? 'rgba(0, 0, 0, 0.15)' : 'var(--border-card-glass, rgba(255,255,255,0.1))',
              color: 'inherit',
              fontSize: '11px',
              fontWeight: 800
            }}
          >
            {sales.filter(s => s.status === 'PRECOMPRA').length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSalesSubmenu('completed')}
          className={`${styles.salesSubmenuButton} ${salesSubmenu === 'completed' ? styles.salesSubmenuActive : ''}`}
          style={{
            background: salesSubmenu === 'completed' ? 'var(--text-primary, #fff)' : 'transparent',
            color: salesSubmenu === 'completed' ? 'var(--bg-page, #000)' : 'var(--text-secondary, #888)',
            border: '1px solid transparent',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 150ms ease'
          }}
        >
          Entregados / Completados
          <span 
            className={styles.salesSubmenuCount}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 6px',
              borderRadius: '999px',
              background: salesSubmenu === 'completed' ? 'rgba(0, 0, 0, 0.15)' : 'var(--border-card-glass, rgba(255,255,255,0.1))',
              color: 'inherit',
              fontSize: '11px',
              fontWeight: 800
            }}
          >
            {sales.filter(s => s.status === 'COMPLETADA').length}
          </span>
        </button>
      </div>

      {/* Filter panel */}
      <div className={styles.salesFiltersBar}>
        <input
          type="text"
          placeholder="Buscar por Email, Teléfono, Lugar o ID..."
          value={salesSearch}
          onChange={(e) => setSalesSearch(e.target.value)}
          className={styles.salesSearchInput}
        />

        <select
          value={salesFilterPayment}
          onChange={(e: any) => setSalesFilterPayment(e.target.value)}
          className={styles.salesSelectFilter}
        >
          <option value="all">Todos los Pagos</option>
          <option value="REVOLUT">Revolut</option>
          <option value="PAYPAL">PayPal</option>
          <option value="EFECTIVO">Efectivo</option>
          <option value="RESERVA">Reserva</option>
        </select>

        <select
          value={salesFilterStatus}
          onChange={(e: any) => setSalesFilterStatus(e.target.value)}
          className={styles.salesSelectFilter}
        >
          <option value="all">Todos los Estados</option>
          <option value="COMPLETADA">Completada</option>
          <option value="PRECOMPRA">Precompra</option>
        </select>

        <select
          value={salesFilterDate}
          onChange={(e: any) => setSalesFilterDate(e.target.value)}
          className={styles.salesSelectFilter}
        >
          <option value="all">Cualquier Fecha</option>
          <option value="today">Hoy</option>
          <option value="week">Últimos 7 días</option>
          <option value="month">Este mes</option>
        </select>

        <button
          type="button"
          disabled={exportingSales || filteredSales.length === 0}
          onClick={() => handleExportSalesCSV(filteredSales)}
          className={`${styles.actionButton} ${styles.actionButtonYellow}`}
          style={{ marginLeft: 'auto' }}
        >
          {exportingSales ? 'Exportando...' : '↑ Exportar CSV'}
        </button>
      </div>

      {/* Dynamic Financial Summary Panel */}
      <div className={styles.salesSummaryGrid}>
        <div className={styles.salesSummaryCard}>
          <span className={styles.salesSummaryLabel}>Total Facturado</span>
          <span className={styles.salesSummaryValue}>{formatPrice(totalRevenue)}</span>
        </div>
        <div className={styles.salesSummaryCard}>
          <span className={styles.salesSummaryLabel}>Ventas Registradas</span>
          <span className={styles.salesSummaryValue}>{totalSalesCount}</span>
        </div>
        <div className={styles.salesSummaryCard}>
          <span className={styles.salesSummaryLabel}>Por Método de Pago</span>
          <div className={styles.salesSummaryPayments}>
            <div className={styles.salesSummaryPayItem}>
              <span className={styles.payName}>Revolut:</span>
              <span className={styles.payVal}>{formatPrice(revenueByPayment['REVOLUT'] || 0)}</span>
            </div>
            <div className={styles.salesSummaryPayItem}>
              <span className={styles.payName}>PayPal:</span>
              <span className={styles.payVal}>{formatPrice(revenueByPayment['PAYPAL'] || 0)}</span>
            </div>
            <div className={styles.salesSummaryPayItem}>
              <span className={styles.payName}>Efectivo:</span>
              <span className={styles.payVal}>{formatPrice(revenueByPayment['EFECTIVO'] || 0)}</span>
            </div>
            <div className={styles.salesSummaryPayItem}>
              <span className={styles.payName}>Reserva:</span>
              <span className={styles.payVal}>{formatPrice(revenueByPayment['RESERVA'] || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {loadingSales ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Cargando ventas...</div>
      ) : filteredSales.length === 0 ? (
        <div className={styles.salesEmptyState}>
          <p>No se encontraron registros de ventas con los filtros actuales.</p>
        </div>
      ) : (
        <div className={styles.salesTableWrapper}>
          <table className={styles.salesTable}>
            <thead>
              <tr>
                <th>ID Venta</th>
                <th>Fecha</th>
                <th>Comprador</th>
                <th>Ubicación</th>
                <th>Pago</th>
                <th style={{ textAlign: 'center' }}>Artículos</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => (
                <tr key={sale.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {sale.id.substring(0, 8).toUpperCase()}
                  </td>
                  <td>
                    {new Date(sale.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td>
                    {sale.buyer_email || sale.buyer_phone || sale.buyer_instagram ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {sale.buyer_email && <span style={{ fontSize: '13px' }}>{sale.buyer_email}</span>}
                        {sale.buyer_phone && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sale.buyer_phone}</span>}
                        {sale.buyer_instagram && <span style={{ fontSize: '11px', color: '#e1306c', fontWeight: 700 }}>{sale.buyer_instagram}</span>}
                      </div>
                    ) : (
                      <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>Directa</span>
                    )}
                  </td>
                  <td>{sale.location}</td>
                  <td>
                    <span className={styles.paymentBadge}>{sale.payment_type}</span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {sale.total_articles}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {formatPrice(sale.total_price)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`${styles.statusBadge} ${sale.status === 'PRECOMPRA' ? styles.statusBadgePrepurchase : styles.statusBadgeCompleted}`}>
                      {sale.payment_type === 'RESERVA' && sale.status === 'PRECOMPRA' ? 'RESERVADO' : sale.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => viewSaleDetail(sale)}
                      className={styles.viewDetailBtn}
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sale Detail Modal */}
      {selectedSaleDetail && (() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const invoiceUrl = `${origin}/invoice/${selectedSaleDetail.id}`;
        const sharingText = `Recibo de Venta - MiniEngines Creations (ID: ${selectedSaleDetail.id.substring(0, 8)})`;
        
        const encodedText = encodeURIComponent(sharingText);
        const encodedUrl = encodeURIComponent(invoiceUrl);
        
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
        const telegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        const emailUrl = `mailto:?subject=${encodeURIComponent(sharingText)}&body=Enlace%20a%20tu%20recibo%20de%20compra:%20${encodedUrl}`;

        return (
          <div className={styles.modalOverlay}>
            <div className={styles.salesConfirmModal} style={{ maxWidth: '640px' }}>
              <h3 className={styles.modalTitle}>Detalle de Venta</h3>
              
              <div className={styles.confirmSummaryInfo} style={{ background: 'none', padding: 0, gap: '6px' }}>
                <div className={styles.summaryRow}>
                  <span>Factura ID:</span>
                  <strong style={{ fontFamily: 'monospace' }}>MEC-{selectedSaleDetail.id.toUpperCase()}</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Fecha:</span>
                  <strong>{new Date(selectedSaleDetail.created_at).toLocaleString('es-ES')}</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Pago:</span>
                  <strong>{selectedSaleDetail.payment_type}</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Lugar:</span>
                  <strong>{selectedSaleDetail.location}</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Cliente:</span>
                  <strong>
                    {selectedSaleDetail.buyer_email || selectedSaleDetail.buyer_phone
                      ? `${selectedSaleDetail.buyer_email || ''} ${selectedSaleDetail.buyer_phone || ''}`
                      : 'Venta Directa'}
                  </strong>
                </div>
                {selectedSaleDetail.buyer_instagram && (
                  <div className={styles.summaryRow}>
                    <span>Instagram:</span>
                    <strong style={{ color: '#e1306c' }}>
                      {selectedSaleDetail.buyer_instagram}
                    </strong>
                  </div>
                )}
                <div className={styles.summaryRow}>
                  <span>Estado:</span>
                  <strong style={{ color: selectedSaleDetail.status === 'PRECOMPRA' ? 'var(--text-soldout)' : 'var(--text-available)' }}>
                    {selectedSaleDetail.payment_type === 'RESERVA' && selectedSaleDetail.status === 'PRECOMPRA' ? 'RESERVADO' : selectedSaleDetail.status}
                  </strong>
                </div>
              </div>

              <h4 style={{ fontSize: '13px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid var(--border-card-glass)', paddingBottom: '4px' }}>Artículos Vendidos</h4>
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-card-glass)', borderRadius: '8px', marginBottom: '16px' }}>
                {loadingSaleItems ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando artículos...</div>
                ) : saleDetailItems.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No hay artículos vinculados a esta venta.</div>
                ) : (
                  saleDetailItems.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-card-glass)', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID Ref: MEC-{String(item.article_id).padStart(4, '0')}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px' }}>
                          Cant: <strong>{item.quantity}</strong>{' '}
                          {item.is_prepurchase ? (
                            <span style={{ color: 'var(--text-soldout)', fontSize: '11px', fontWeight: 'bold' }}>(Precompra)</span>
                          ) : (
                            <span style={{ color: 'var(--text-available)', fontSize: '11px' }}>(Completado)</span>
                          )}
                        </span>
                        <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px' }}>
                          {formatPrice(item.price * item.quantity)}
                        </span>

                        {item.is_prepurchase && (
                          <button
                            type="button"
                            onClick={() => completePrepurchaseItem(item)}
                            className={styles.completeItemBtn}
                            title={selectedSaleDetail.payment_type === 'RESERVA' ? 'Cerrar pago y completar reserva' : 'Marcar como listo y subir stock en 1'}
                          >
                            ✓ Completar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.summaryRow} style={{ fontSize: '16px', fontWeight: 'bold', borderTop: '1px solid var(--border-card-glass)', paddingTop: '10px' }}>
                <span>Total Facturado:</span>
                <span style={{ fontFamily: 'monospace' }}>{formatPrice(selectedSaleDetail.total_price)}</span>
              </div>

              <div style={{ borderTop: '1px solid var(--border-card-glass)', marginTop: '20px', paddingTop: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Compartir Factura:</span>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${styles.shareLink} ${styles.waShare}`} style={{ flex: 1, textDecoration: 'none', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                    <WhatsAppIcon width="16" height="16" />
                    WhatsApp
                  </a>
                  <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className={`${styles.shareLink} ${styles.tgShare}`} style={{ flex: 1, textDecoration: 'none', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                    <TelegramIcon width="16" height="16" />
                    Telegram
                  </a>
                  <a href={emailUrl} className={`${styles.shareLink} ${styles.emailShare}`} style={{ flex: 1, textDecoration: 'none', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                    <EmailIcon width="16" height="16" />
                    Email
                  </a>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--border-card-glass)', paddingTop: '16px' }}>
                <a
                  href={invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.primaryButton} ${styles.solidBlueButton}`}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center', fontSize: '13px' }}
                >
                  Ver Online / PDF 📄
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSaleDetail(null);
                    setSaleDetailItems([]);
                  }}
                  className={`${styles.secondaryButton} ${styles.solidGrayButton}`}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
