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
  const [salesFilterPayment, setSalesFilterPayment] = useState<'all' | 'BIZUM' | 'PAYPAL' | 'EFECTIVO' | 'RESERVA' | 'SQUARE'>('all');
  const [salesFilterStatus, setSalesFilterStatus] = useState<'all' | 'COMPLETADA' | 'PRECOMPRA' | 'CANCELADA'>('all');
  const [salesFilterDate, setSalesFilterDate] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [exportingSales, setExportingSales] = useState(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [saleDetailItems, setSaleDetailItems] = useState<SaleItem[]>([]);
  const [loadingSaleItems, setLoadingSaleItems] = useState(false);

  // Edit states for details modal
  const [isEditingSale, setIsEditingSale] = useState(false);
  const [editBuyerName, setEditBuyerName] = useState('');
  const [editBuyerEmail, setEditBuyerEmail] = useState('');
  const [editBuyerPhone, setEditBuyerPhone] = useState('');
  const [editBuyerInstagram, setEditBuyerInstagram] = useState('');
  const [editPaymentType, setEditPaymentType] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editShippingStatus, setEditShippingStatus] = useState('PENDIENTE');

  // Shipping states
  const [shippingInputVisible, setShippingInputVisible] = useState(false);
  const [trackingLinkInput, setTrackingLinkInput] = useState('');
  const [savingShipping, setSavingShipping] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);

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

  async function handleUpdateShipping(sale: Sale, newStatus: string, trackingLink?: string) {
    setSavingShipping(true);
    try {
      const updates: Record<string, unknown> = { shipping_status: newStatus };
      if (trackingLink !== undefined) updates.tracking_link = trackingLink;

      const { error } = await supabase
        .from('sales')
        .update(updates)
        .eq('id', sale.id);

      if (error) throw error;

      // Send shipping notification email when marking as ENVIADO
      if (newStatus === 'ENVIADO') {
        const buyerEmail = sale.receipt_email || sale.buyer_email;
        if (buyerEmail) {
          try {
            await fetch('/api/sales/notify-shipped', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ saleId: sale.id, trackingLink: trackingLink || null }),
            });
          } catch (emailErr) {
            // Non-blocking — log but don't fail the status update
            console.warn('[notify-shipped] Email failed (non-critical):', emailErr);
          }
        }
      }

      // Update local state
      setSales((prev) => prev.map((s) => s.id === sale.id ? { ...s, ...updates } : s));
      setSelectedSaleDetail((prev) => prev ? { ...prev, ...updates } : prev);
      setShippingInputVisible(false);
      setTrackingLinkInput('');
    } catch (e) {
      console.error('Error updating shipping:', e);
      alert('Error al actualizar el envío.');
    } finally {
      setSavingShipping(false);
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
    } catch (e: any) {
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

      if (
        selectedSaleDetail.payment_type !== 'RESERVA' &&
        selectedSaleDetail.payment_type !== 'BIZUM' &&
        selectedSaleDetail.payment_type !== 'PAYPAL' &&
        item.article_id
      ) {
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

  async function handleCancelSale(sale: Sale) {
    if (!confirm('¿Estás seguro de que deseas cancelar o realizar la devolución de esta venta? Esta acción devolverá los artículos al stock y marcará el pedido como CANCELADO/DEVUELTO.')) {
      return;
    }

    try {
      // 1. Update sale status to CANCELADA in database
      const { error: saleError } = await supabase
        .from('sales')
        .update({ status: 'CANCELADA' })
        .eq('id', sale.id);

      if (saleError) throw saleError;

      // 2. Return articles to stock
      for (const item of saleDetailItems) {
        if (item.article_id) {
          const { data: artData } = await supabase
            .from('articles')
            .select('quantity')
            .eq('id', item.article_id)
            .single();

          const currentQty = artData ? artData.quantity : 0;

          const { error: stockError } = await supabase
            .from('articles')
            .update({ quantity: currentQty + item.quantity })
            .eq('id', item.article_id);

          if (stockError) {
            console.error(`Error updating stock for article ID ${item.article_id} on cancellation:`, stockError);
          }
        }
      }

      setSelectedSaleDetail({ ...sale, status: 'CANCELADA' });
      alert('¡La venta ha sido cancelada y los artículos han sido devueltos al stock!');

      await loadSales();
      await loadArticles();
    } catch (e: any) {
      alert(`Error al cancelar la venta: ${e.message || e}`);
    }
  }

  async function handleDeleteSale(saleId: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este registro de venta? Esta acción no se puede deshacer y borrará también su historial de artículos.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId);

      if (error) throw error;

      alert('¡Venta eliminada permanentemente!');
      await loadSales();
    } catch (e: any) {
      alert(`Error al eliminar la venta: ${e.message || e}`);
    }
  }

  async function handleConfirmPayment(sale: Sale) {
    if (!confirm('¿Estás seguro de que deseas confirmar el pago de este pedido? Esto cambiará su estado a COMPLETADA.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sales')
        .update({ status: 'COMPLETADA' })
        .eq('id', sale.id);

      if (error) throw error;

      setSelectedSaleDetail({ ...sale, status: 'COMPLETADA' });
      alert('¡El pago ha sido confirmado y la venta ha sido marcada como COMPLETADA!');

      await loadSales();
    } catch (e: any) {
      alert(`Error al confirmar el pago: ${e.message || e}`);
    }
  }

  async function handleSaveSaleEdit() {
    if (!selectedSaleDetail) return;
    try {
      const { error } = await supabase
        .from('sales')
        .update({
          buyer_name: editBuyerName || null,
          buyer_email: editBuyerEmail || null,
          receipt_email: editBuyerEmail || null,
          buyer_phone: editBuyerPhone || null,
          receipt_whatsapp: editBuyerPhone || null,
          buyer_instagram: editBuyerInstagram || null,
          payment_type: editPaymentType || null,
          location: editLocation || null,
          shipping_status: editShippingStatus || 'PENDIENTE',
        })
        .eq('id', selectedSaleDetail.id);

      if (error) throw error;

      const updatedSale = {
        ...selectedSaleDetail,
        buyer_name: editBuyerName,
        buyer_email: editBuyerEmail,
        receipt_email: editBuyerEmail,
        buyer_phone: editBuyerPhone,
        receipt_whatsapp: editBuyerPhone,
        buyer_instagram: editBuyerInstagram,
        payment_type: editPaymentType as any,
        location: editLocation,
        shipping_status: editShippingStatus,
      };

      setSelectedSaleDetail(updatedSale);
      setIsEditingSale(false);
      alert('¡Pedido actualizado con éxito!');

      await loadSales();
    } catch (e: any) {
      alert(`Error al guardar los cambios del pedido: ${e.message || e}`);
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
    if (s.status === 'CANCELADA') {
      return sum;
    }
    if (s.payment_type === 'RESERVA' && s.status === 'PRECOMPRA') {
      return sum;
    }
    return sum + Number(s.total_price);
  }, 0);
  const totalSalesCount = filteredSales.filter(s => s.status !== 'CANCELADA').length;
  const revenueByPayment = filteredSales.reduce((acc, s) => {
    if (s.status === 'CANCELADA') {
      return acc;
    }
    if (s.payment_type === 'RESERVA' && s.status === 'PRECOMPRA') {
      return acc;
    }
    const type = s.payment_type || 'OTRO';
    acc[type] = (acc[type] || 0) + Number(s.total_price);
    return acc;
  }, {} as Record<string, number>);

  const completedSalesCount = filteredSales.filter(s => s.status === 'COMPLETADA').length;
  const pendingReservationsCount = filteredSales.filter(s => s.payment_type === 'RESERVA' && s.status === 'PRECOMPRA').length;
  const pendingPrepurchasesCount = filteredSales.filter(s => s.payment_type !== 'RESERVA' && s.status === 'PRECOMPRA').length;
  const cancelledSalesCount = filteredSales.filter(s => s.status === 'CANCELADA').length;

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
          <option value="BIZUM">Bizum / Transferencia</option>
          <option value="PAYPAL">PayPal</option>
          <option value="EFECTIVO">Efectivo</option>
          <option value="RESERVA">Reserva</option>
          <option value="SQUARE">Tarjeta (Square)</option>
        </select>

        <select
          value={salesFilterStatus}
          onChange={(e: any) => setSalesFilterStatus(e.target.value)}
          className={styles.salesSelectFilter}
        >
          <option value="all">Todos los Estados</option>
          <option value="COMPLETADA">Completada</option>
          <option value="PRECOMPRA">Precompra</option>
          <option value="CANCELADA">Cancelada/Devuelta</option>
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
          <div className={styles.salesSummaryPayments} style={{ marginTop: '8px', borderTop: '1px solid var(--border-card-glass)', paddingTop: '6px' }}>
            <div className={styles.salesSummaryPayItem}>
              <span className={styles.payName}>Completadas:</span>
              <span className={styles.payVal}><strong>{completedSalesCount}</strong></span>
            </div>
            <div className={styles.salesSummaryPayItem}>
              <span className={styles.payName}>Reservas:</span>
              <span className={styles.payVal}><strong>{pendingReservationsCount}</strong></span>
            </div>
            {pendingPrepurchasesCount > 0 && (
              <div className={styles.salesSummaryPayItem}>
                <span className={styles.payName}>Precompras:</span>
                <span className={styles.payVal}><strong>{pendingPrepurchasesCount}</strong></span>
              </div>
            )}
            {cancelledSalesCount > 0 && (
              <div className={styles.salesSummaryPayItem}>
                <span className={styles.payName}>Canceladas:</span>
                <span className={styles.payVal}><strong>{cancelledSalesCount}</strong></span>
              </div>
            )}
          </div>
        </div>
        <div className={styles.salesSummaryCard}>
          <span className={styles.salesSummaryLabel}>Por Método de Pago</span>
          <div className={styles.salesSummaryPayments}>
            <div className={styles.salesSummaryPayItem}>
              <span className={styles.payName}>Bizum:</span>
              <span className={styles.payVal}>{formatPrice((revenueByPayment['BIZUM'] || 0) + (revenueByPayment['REVOLUT'] || 0))}</span>
            </div>
            <div className={styles.salesSummaryPayItem}>
              <span className={styles.payName}>PayPal:</span>
              <span className={styles.payVal}>{formatPrice(revenueByPayment['PAYPAL'] || 0)}</span>
            </div>
            <div className={styles.salesSummaryPayItem}>
              <span className={styles.payName}>Efectivo:</span>
              <span className={styles.payVal}>{formatPrice(revenueByPayment['EFECTIVO'] || 0)}</span>
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
                    {(() => {
                      const pt = sale.payment_type;
                      const cfg: Record<string, { emoji: string; label: string; bg: string; color: string }> = {
                        BIZUM:    { emoji: 'Ⓑ', label: 'Bizum',   bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
                        PAYPAL:   { emoji: 'Ⓟ', label: 'PayPal',  bg: 'rgba(0,112,243,0.12)',  color: '#0070f3' },
                        SQUARE:   { emoji: '💳', label: 'Tarjeta', bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
                        EFECTIVO: { emoji: '💵', label: 'Efectivo',bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
                        RESERVA:  { emoji: '📋', label: 'Reserva', bg: 'rgba(37,99,235,0.12)',  color: '#2563eb' },
                      };
                      const c = cfg[pt] || { emoji: '?', label: pt, bg: 'rgba(107,114,128,0.12)', color: '#6b7280' };
                      return (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 8px', borderRadius: '6px',
                          background: c.bg, color: c.color,
                          fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap',
                        }}>
                          {c.emoji} {c.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {sale.total_articles}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {formatPrice(sale.total_price)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`${styles.statusBadge} ${
                      sale.status === 'CANCELADA' ? styles.statusBadgeCancelled :
                      (sale.payment_type === 'RESERVA' && sale.status === 'PRECOMPRA') ? styles.statusBadgeReserved :
                      sale.status === 'PRECOMPRA' ? styles.statusBadgePrepurchase : 
                      styles.statusBadgeCompleted
                    }`}>
                      {sale.status === 'CANCELADA' ? 'CANCELADO/DEVUELTO' : 
                       (sale.payment_type === 'RESERVA' && sale.status === 'PRECOMPRA' ? 'RESERVADO' : sale.status)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* WhatsApp pending badge */}
                      {sale.receipt_whatsapp && !sale.whatsapp_sent && (
                        <a
                          href={`https://wa.me/${(sale.receipt_whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hola${sale.buyer_name ? ' ' + sale.buyer_name : ''}, tu pedido MEC-${sale.id.substring(0,8).toUpperCase()} está listo.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp pendiente de envío — pulsa para abrir"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 8px', borderRadius: '6px',
                            background: '#f97316', color: '#fff',
                            fontSize: '10px', fontWeight: 'bold',
                            textDecoration: 'none', whiteSpace: 'nowrap',
                            animation: 'pulse 2s infinite',
                          }}
                          onClick={async (e) => {
                            // Mark as sent after clicking
                            await (await import('@/lib/supabase')).supabase
                              .from('sales').update({ whatsapp_sent: true }).eq('id', sale.id);
                          }}
                        >
                          📱 WA
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => viewSaleDetail(sale)}
                        className={styles.viewDetailBtn}
                      >
                        Ver Detalle
                      </button>
                      {sale.status === 'CANCELADA' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSale(sale.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                          title="Eliminar venta permanentemente"
                        >
                          Eliminar 🗑️
                        </button>
                      )}
                    </div>
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
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px' }}>
                <h3 className={styles.modalTitle} style={{ margin: 0 }}>Detalle de Venta</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isEditingSale ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveSaleEdit}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '12px',
                          background: '#10b981',
                          color: '#fff',
                          transition: 'background 0.2s',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                      >
                        Guardar ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingSale(false)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '12px',
                          background: '#6b7280',
                          color: '#fff',
                          transition: 'background 0.2s',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#4b5563'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#6b7280'}
                      >
                        Cancelar ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditBuyerName(selectedSaleDetail.buyer_name || '');
                          setEditBuyerEmail(selectedSaleDetail.buyer_email || selectedSaleDetail.receipt_email || '');
                          setEditBuyerPhone(selectedSaleDetail.buyer_phone || selectedSaleDetail.receipt_whatsapp || '');
                          setEditBuyerInstagram(selectedSaleDetail.buyer_instagram || '');
                          setEditPaymentType(selectedSaleDetail.payment_type || '');
                          setEditLocation(selectedSaleDetail.location || '');
                          setEditShippingStatus(selectedSaleDetail.shipping_status || 'PENDIENTE');
                          setIsEditingSale(true);
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: '1.5px solid #6366f1',
                          color: '#6366f1',
                          background: 'none',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(99,102,241,0.06)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'none';
                        }}
                      >
                        Editar Pedido ✏️
                      </button>
                      {selectedSaleDetail.status === 'PRECOMPRA' && (
                        <button
                          type="button"
                          onClick={() => handleConfirmPayment(selectedSaleDetail)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '12px',
                            background: '#10b981',
                            color: '#fff',
                            transition: 'background 0.2s',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                        >
                          Confirmar Pago ✓
                        </button>
                      )}
                      {selectedSaleDetail.status !== 'CANCELADA' && (
                        <button
                          type="button"
                          onClick={() => handleCancelSale(selectedSaleDetail)}
                          className={`${styles.dangerButton} ${styles.solidRedButton}`}
                          style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', textWrap: 'nowrap' }}
                        >
                          Devolución / Cancelar ✕
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className={styles.confirmSummaryInfo} style={{ background: 'none', padding: 0, gap: '6px' }}>
                <div className={styles.summaryRow}>
                  <span>Factura ID:</span>
                  <strong style={{ fontFamily: 'monospace' }}>MEC-{selectedSaleDetail.id.toUpperCase()}</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Fecha:</span>
                  <strong>{new Date(selectedSaleDetail.created_at).toLocaleString('es-ES')}</strong>
                </div>

                {isEditingSale ? (
                  <>
                    <div className={styles.summaryRow} style={{ alignItems: 'center' }}>
                      <span>Pago:</span>
                      <input
                        type="text"
                        value={editPaymentType}
                        onChange={(e) => setEditPaymentType(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-input)',
                          fontSize: '13px',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          width: '180px',
                          fontWeight: 'bold',
                        }}
                      />
                    </div>
                    <div className={styles.summaryRow} style={{ alignItems: 'center' }}>
                      <span>Lugar:</span>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-input)',
                          fontSize: '13px',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          width: '180px',
                          fontWeight: 'bold',
                        }}
                      />
                    </div>
                    <div className={styles.summaryRow} style={{ alignItems: 'center' }}>
                      <span>Nombre Cliente:</span>
                      <input
                        type="text"
                        value={editBuyerName}
                        onChange={(e) => setEditBuyerName(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-input)',
                          fontSize: '13px',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          width: '240px',
                          fontWeight: 'bold',
                        }}
                      />
                    </div>
                    <div className={styles.summaryRow} style={{ alignItems: 'center' }}>
                      <span>Email Cliente:</span>
                      <input
                        type="text"
                        value={editBuyerEmail}
                        onChange={(e) => setEditBuyerEmail(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-input)',
                          fontSize: '13px',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          width: '240px',
                          fontWeight: 'bold',
                        }}
                      />
                    </div>
                    <div className={styles.summaryRow} style={{ alignItems: 'center' }}>
                      <span>Teléfono Cliente:</span>
                      <input
                        type="text"
                        value={editBuyerPhone}
                        onChange={(e) => setEditBuyerPhone(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-input)',
                          fontSize: '13px',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          width: '240px',
                          fontWeight: 'bold',
                        }}
                      />
                    </div>
                    <div className={styles.summaryRow} style={{ alignItems: 'center' }}>
                      <span>Instagram Cliente:</span>
                      <input
                        type="text"
                        value={editBuyerInstagram}
                        onChange={(e) => setEditBuyerInstagram(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-input)',
                          fontSize: '13px',
                          background: 'var(--bg-input)',
                          width: '240px',
                          color: '#e1306c',
                          fontWeight: 'bold',
                        }}
                      />
                    </div>
                    {/* Shipping status — only editable here, locked in the status panel */}
                    <div className={styles.summaryRow} style={{ alignItems: 'center' }}>
                      <span>Estado Envío:</span>
                      <select
                        value={editShippingStatus}
                        onChange={(e) => setEditShippingStatus(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-input)',
                          fontSize: '13px',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="PENDIENTE">📦 Pendiente</option>
                        <option value="ENVIADO">🚚 Enviado</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
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
                        {selectedSaleDetail.buyer_email || selectedSaleDetail.buyer_phone ? (
                          <>
                            {selectedSaleDetail.buyer_name && `${selectedSaleDetail.buyer_name} - `}
                            {selectedSaleDetail.buyer_email || ''} {selectedSaleDetail.buyer_phone || ''}
                          </>
                        ) : (
                          'Venta Directa'
                        )}
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
                  </>
                )}

                <div className={styles.summaryRow}>
                  <span>Estado:</span>
                  <strong style={{ color: 
                    selectedSaleDetail.status === 'CANCELADA' ? '#dc2626' :
                    (selectedSaleDetail.payment_type === 'RESERVA' && selectedSaleDetail.status === 'PRECOMPRA') ? '#2563eb' :
                    selectedSaleDetail.status === 'PRECOMPRA' ? '#d97706' : 
                    '#16a34a' 
                  }}>
                    {selectedSaleDetail.status === 'CANCELADA' ? 'CANCELADO/DEVUELTO' :
                     (selectedSaleDetail.payment_type === 'RESERVA' && selectedSaleDetail.status === 'PRECOMPRA' ? 'RESERVADO' : selectedSaleDetail.status)}
                  </strong>
                </div>
              </div>

              <h4 style={{ fontSize: '13px', fontWeight: 'bold', margin: '16px 0 8px 0', borderBottom: '1px solid var(--border-card-glass)', paddingBottom: '4px' }}>Artículos Vendidos</h4>
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-card-glass)', borderRadius: '8px', marginBottom: '16px', flexShrink: 0 }}>
                {loadingSaleItems ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando artículos...</div>
                ) : saleDetailItems.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No hay artículos vinculados a esta venta.</div>
                ) : (
                  saleDetailItems.map((item) => {
                    const article = articles.find((a) => a.id === item.article_id);
                    const imageUrl = article?.image_urls?.[0];

                    return (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-card-glass)', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {imageUrl && (
                            <img
                              src={imageUrl}
                              alt={item.title}
                              style={{
                                width: '40px',
                                height: '40px',
                                objectFit: 'cover',
                                borderRadius: '6px',
                                border: '1px solid var(--border-card-glass)',
                                background: '#f5f5f5',
                              }}
                            />
                          )}
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.title}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID Ref: MEC-{String(item.article_id).padStart(4, '0')}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px' }}>
                            Cant: <strong>{item.quantity}</strong>{' '}
                            {(() => {
                              const isReserva = selectedSaleDetail.payment_type === 'RESERVA' && item.is_prepurchase;
                              const isPrepurchase = !isReserva && (item.is_prepurchase || (
                                selectedSaleDetail.status === 'PRECOMPRA' &&
                                (selectedSaleDetail.payment_type === 'BIZUM' || selectedSaleDetail.payment_type === 'PAYPAL')
                              ));
                              if (isReserva) return (
                                <span style={{ color: '#3b82f6', fontSize: '11px', fontWeight: 'bold' }}>(Reserva)</span>
                              );
                              if (isPrepurchase) return (
                                <span style={{ color: 'var(--text-soldout)', fontSize: '11px', fontWeight: 'bold' }}>(Precompra)</span>
                              );
                              return (
                                <span style={{ color: 'var(--text-available)', fontSize: '11px' }}>(Completado)</span>
                              );
                            })()}
                          </span>
                          <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px' }}>
                            {formatPrice(item.price * item.quantity)}
                          </span>

                          {(item.is_prepurchase || (
                            selectedSaleDetail.status === 'PRECOMPRA' &&
                            (selectedSaleDetail.payment_type === 'BIZUM' || selectedSaleDetail.payment_type === 'PAYPAL')
                        )) && (
                          <button
                            type="button"
                            onClick={() => completePrepurchaseItem(item)}
                            className={styles.completeItemBtn}
                            title={selectedSaleDetail.payment_type === 'RESERVA' ? 'Cerrar pago y completar reserva' : 'Marcar como enviado y completar pedido'}
                          >
                            ✓ Completar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
                )}
              </div>

              {/* Shipping status section */}
              {selectedSaleDetail.location !== 'presencial' && (
                <div style={{ borderTop: '1px solid var(--border-card-glass)', marginTop: '16px', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Estado de Envío:</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        disabled={selectedSaleDetail.shipping_status === 'ENVIADO'}
                        onClick={() => {
                          if (!selectedSaleDetail.shipping_status || selectedSaleDetail.shipping_status === 'PENDIENTE') return;
                          // Only reachable in edit mode (button is disabled when ENVIADO)
                        }}
                        title={selectedSaleDetail.shipping_status === 'ENVIADO' ? '🔒 Ya enviado — solo editable desde "Editar Pedido"' : undefined}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: selectedSaleDetail.shipping_status === 'ENVIADO' ? 'not-allowed' : 'default',
                          background: (!selectedSaleDetail.shipping_status || selectedSaleDetail.shipping_status === 'PENDIENTE') ? '#d97706' : 'rgba(107,114,128,0.15)',
                          color: (!selectedSaleDetail.shipping_status || selectedSaleDetail.shipping_status === 'PENDIENTE') ? '#fff' : '#9ca3af',
                          opacity: selectedSaleDetail.shipping_status === 'ENVIADO' ? 0.5 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        📦 Pendiente
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedSaleDetail.shipping_status !== 'ENVIADO') {
                            setShippingInputVisible(true);
                            setTrackingLinkInput(selectedSaleDetail.tracking_link || '');
                          }
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: selectedSaleDetail.shipping_status === 'ENVIADO' ? 'default' : 'pointer',
                          background: selectedSaleDetail.shipping_status === 'ENVIADO' ? '#10b981' : 'rgba(16,185,129,0.15)',
                          color: selectedSaleDetail.shipping_status === 'ENVIADO' ? '#fff' : '#10b981',
                          transition: 'all 0.2s',
                        }}
                      >
                        🚚 Enviado
                      </button>
                    </div>
                  </div>

                  {/* Tracking link input — appears when clicking Enviado */}
                  {shippingInputVisible && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', padding: '10px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#10b981' }}>Link de seguimiento (opcional):</label>
                      <input
                        type="url"
                        value={trackingLinkInput}
                        onChange={(e) => setTrackingLinkInput(e.target.value)}
                        placeholder="https://tracking.correos.es/..."
                        style={{
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(16,185,129,0.4)',
                          fontSize: '12px',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateShipping(selectedSaleDetail, 'ENVIADO', trackingLinkInput || undefined)}
                          disabled={savingShipping}
                          style={{
                            flex: 1, padding: '7px', borderRadius: '6px', border: 'none',
                            background: '#10b981', color: '#fff', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
                          }}
                        >
                          {savingShipping ? 'Guardando...' : '✓ Confirmar Envío'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShippingInputVisible(false); setTrackingLinkInput(''); }}
                          style={{
                            padding: '7px 12px', borderRadius: '6px', border: 'none',
                            background: 'var(--bg-card)', color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Show tracking link if set */}
                  {selectedSaleDetail.shipping_status === 'ENVIADO' && selectedSaleDetail.tracking_link && !shippingInputVisible && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '8px 10px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>🔗 Seguimiento:</span>
                      <a
                        href={selectedSaleDetail.tracking_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '11px', color: '#10b981', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', fontWeight: 'bold' }}
                      >
                        {selectedSaleDetail.tracking_link}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedSaleDetail.tracking_link!);
                          setCopiedTracking(true);
                          setTimeout(() => setCopiedTracking(false), 2000);
                        }}
                        style={{
                          padding: '4px 8px', borderRadius: '5px', border: 'none',
                          background: copiedTracking ? '#10b981' : 'var(--bg-card)',
                          color: copiedTracking ? '#fff' : 'var(--text-secondary)',
                          fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold', transition: 'all 0.2s',
                        }}
                      >
                        {copiedTracking ? '✓ Copiado' : '📋 Copiar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShippingInputVisible(true); setTrackingLinkInput(selectedSaleDetail.tracking_link || ''); }}
                        style={{ padding: '4px 8px', borderRadius: '5px', border: 'none', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }}
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(() => {
                const shippingInfo = selectedSaleDetail.shipping_address as any;
                const shippingCost = shippingInfo?.price ?? 0;
                const shippingLabel = shippingInfo?.description || (shippingInfo?.method === 'recogida' ? 'Recogida en taller' : 'Envío Peninsular');
                const subtotal = Number(selectedSaleDetail.total_price) - Number(shippingCost);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-card-glass)', paddingTop: '10px' }}>
                    <div className={styles.summaryRow} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span>Subtotal artículos:</span>
                      <span style={{ fontFamily: 'monospace' }}>{formatPrice(subtotal)}</span>
                    </div>
                    <div className={styles.summaryRow} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span>Gastos de envío ({shippingLabel}):</span>
                      <span style={{ fontFamily: 'monospace' }}>{shippingCost === 0 ? 'Gratis' : formatPrice(shippingCost)}</span>
                    </div>
                    <div className={styles.summaryRow} style={{ fontSize: '16px', fontWeight: 'bold', borderTop: '1px dashed var(--border-card-glass)', paddingTop: '6px', marginTop: '4px' }}>
                      <span>Total Facturado:</span>
                      <span style={{ fontFamily: 'monospace' }}>{formatPrice(selectedSaleDetail.total_price)}</span>
                    </div>
                  </div>
                );
              })()}

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
                    setIsEditingSale(false);
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
