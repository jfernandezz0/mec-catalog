'use client';

import { useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import { calculateDiscount } from '@/lib/discounts';
import { buildReceiptWhatsAppLink } from '@/lib/whatsapp';
import { Article, Category, AdminTab } from '@/lib/types';
import styles from '../admin.module.css';

type SalePaymentType = 'BIZUM' | 'PAYPAL' | 'EFECTIVO' | 'RESERVA' | 'SQUARE';

interface SalesCreateTabProps {
  articles: Article[];
  categories: Category[];
  generalDiscountPercent: string;
  loadArticles: () => Promise<void>;
  handleTabChange: (tab: AdminTab) => void;
}

export default function SalesCreateTab({
  articles,
  categories,
  generalDiscountPercent,
  loadArticles,
  handleTabChange,
}: SalesCreateTabProps) {
  // Mode: TPV Rápido vs Formulario Detallado
  const [saleMode, setSaleMode] = useState<'tpv' | 'detailed'>('tpv');

  // TPV State
  const [tpvCart, setTpvCart] = useState<Array<{ article: Article; quantity: number; price: number }>>([]);
  const [tpvLocation, setTpvLocation] = useState('Feria / Evento presencial');
  const [tpvPaymentType, setTpvPaymentType] = useState<SalePaymentType>('EFECTIVO');
  const [tpvCashGiven, setTpvCashGiven] = useState('');
  const [tpvBuyerPhone, setTpvBuyerPhone] = useState('');
  const [tpvSearch, setTpvSearch] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [tpvLastSale, setTpvLastSale] = useState<{
    orderNumber: string;
    total: number;
    phone: string;
    items: Array<{ title: string; price: number }>;
  } | null>(null);

  // Detailed mode states
  const [selectedArticleIds, setSelectedArticleIds] = useState<number[]>([]);
  const [saleItemQuantities, setSaleItemQuantities] = useState<Map<number, string>>(new Map());
  const [saleItemPrices, setSaleItemPrices] = useState<Map<number, string>>(new Map());
  const [saleBuyerPhoneCode, setSaleBuyerPhoneCode] = useState('+34');
  const [saleBuyerPhone, setSaleBuyerPhone] = useState('');
  const [saleBuyerEmail, setSaleBuyerEmail] = useState('');
  const [saleBuyerInstagram, setSaleBuyerInstagram] = useState('');
  const [saleLocation, setSaleLocation] = useState('online');
  const [salePaymentType, setSalePaymentType] = useState<SalePaymentType>('BIZUM');
  const [showSaleSummary, setShowSaleSummary] = useState(false);
  const [registeringSale, setRegisteringSale] = useState(false);
  const [salesCreateSearch, setSalesCreateSearch] = useState('');

  function getFinalPriceForArticle(article: Article): number {
    const originalPrice = typeof article.price === 'string' ? parseFloat(article.price) : article.price;
    const cat = categories.find((c) => c.id === article.category_id);
    const catDiscount = cat ? cat.discount_percent : null;
    const discInfo = calculateDiscount(
      originalPrice,
      article.discount_type,
      article.discount_value,
      catDiscount,
      generalDiscountPercent
    );
    return discInfo.finalPrice;
  }

  function getItemPrice(id: number, article: Article): number {
    if (saleItemPrices.has(id)) {
      const raw = saleItemPrices.get(id);
      if (raw === '' || raw === undefined) return 0;
      const parsed = parseFloat(raw);
      return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    return getFinalPriceForArticle(article);
  }

  function getItemQuantity(id: number): number {
    const raw = saleItemQuantities.get(id);
    if (raw === '' || raw === undefined) return 1;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 1 : Math.max(1, parsed);
  }

  // TPV Operations
  function addTpvItem(article: Article) {
    setTpvCart((prev) => {
      const existing = prev.find((item) => item.article.id === article.id);
      if (existing) {
        if (existing.quantity >= article.quantity) {
          alert(`No hay más stock disponible de ${article.title} (Stock: ${article.quantity})`);
          return prev;
        }
        return prev.map((item) =>
          item.article.id === article.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { article, quantity: 1, price: getFinalPriceForArticle(article) }];
    });
  }

  function updateTpvQty(articleId: number, delta: number) {
    setTpvCart((prev) =>
      prev
        .map((item) => {
          if (item.article.id === articleId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.article.quantity) {
              alert(`Máximo stock disponible: ${item.article.quantity}`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function removeTpvItem(articleId: number) {
    setTpvCart((prev) => prev.filter((item) => item.article.id !== articleId));
  }

  async function handleTpvSale() {
    if (tpvCart.length === 0) {
      alert('Añade al menos un artículo al ticket del TPV');
      return;
    }

    setRegisteringSale(true);
    try {
      const totalAmount = tpvCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const totalCount = tpvCart.reduce((sum, item) => sum + item.quantity, 0);

      const cleanPhone = tpvBuyerPhone.replace(/\D/g, '');
      const fullPhone = cleanPhone ? (cleanPhone.startsWith('34') ? `+${cleanPhone}` : `+34${cleanPhone}`) : null;

      // 1. Insert sale record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          buyer_phone: fullPhone,
          receipt_whatsapp: fullPhone,
          location: tpvLocation.trim() || 'Feria / Evento presencial',
          payment_type: tpvPaymentType,
          total_price: totalAmount,
          total_articles: totalCount,
          status: 'COMPLETADA',
        })
        .select()
        .single();

      if (saleError || !saleData) {
        throw new Error(saleError?.message || 'Error al crear la venta');
      }

      // 2. Insert sale items
      const itemsToInsert = tpvCart.map((item) => ({
        sale_id: saleData.id,
        article_id: item.article.id,
        title: item.article.title,
        quantity: item.quantity,
        price: item.price,
        is_prepurchase: false,
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // 3. Atomically update article stock
      for (const item of tpvCart) {
        const nextStock = Math.max(0, item.article.quantity - item.quantity);
        const { error: stockError } = await supabase
          .from('articles')
          .update({ quantity: nextStock, reserved_until: null })
          .eq('id', item.article.id);

        if (stockError) {
          console.error(`Error decrementing stock for ${item.article.id}:`, stockError);
        }
      }

      // 4. Record last sale for modal & WhatsApp receipt
      const orderNum = saleData.order_number || `MEC-FERIA-${saleData.id.substring(0, 6).toUpperCase()}`;
      setTpvLastSale({
        orderNumber: orderNum,
        total: totalAmount,
        phone: fullPhone || '',
        items: tpvCart.map((i) => ({ title: i.article.title, price: i.price * i.quantity })),
      });

      // 5. Reset TPV
      setTpvCart([]);
      setTpvCashGiven('');
      setTpvBuyerPhone('');
      await loadArticles();
    } catch (err) {
      console.error('Error in TPV sale:', err);
      alert(err instanceof Error ? err.message : 'Error al registrar la venta en TPV');
    } finally {
      setRegisteringSale(false);
    }
  }

  async function handleRegisterSale() {
    if (selectedArticleIds.length === 0) {
      alert('Debes seleccionar al menos un artículo para registrar la venta.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (saleBuyerEmail.trim() && !emailRegex.test(saleBuyerEmail.trim())) {
      alert('Por favor introduce un email válido.');
      return;
    }

    const phoneRegex = /^[0-9\s\-()+]+$/;
    if (saleBuyerPhone.trim() && !phoneRegex.test(saleBuyerPhone.trim())) {
      alert('Por favor introduce un teléfono válido (solo números y espacios).');
      return;
    }

    setRegisteringSale(true);
    try {
      let totalPrice = 0;
      let totalArticlesCount = 0;
      let hasPrepurchase = false;

      const itemsToInsert: Array<{
        article_id: number;
        title: string;
        quantity: number;
        price: number;
        is_prepurchase: boolean;
      }> = [];
      const stockUpdates: Array<{ id: number; quantity: number }> = [];

      for (const id of selectedArticleIds) {
        const article = articles.find((a) => a.id === id);
        if (!article) continue;

        const qty = getItemQuantity(id);
        const customPrice = getItemPrice(id, article);

        const isPrepurchase = salePaymentType === 'RESERVA' || qty > article.quantity;
        if (isPrepurchase) {
          hasPrepurchase = true;
        }

        totalPrice += customPrice * qty;
        totalArticlesCount += qty;

        itemsToInsert.push({
          article_id: id,
          title: article.title,
          quantity: qty,
          price: customPrice,
          is_prepurchase: isPrepurchase,
        });

        stockUpdates.push({
          id,
          quantity: Math.max(0, article.quantity - qty),
        });
      }

      const fullPhoneNumber = saleBuyerPhone.trim()
        ? `${saleBuyerPhoneCode}${saleBuyerPhone.trim()}`
        : '';

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          buyer_phone: fullPhoneNumber || null,
          buyer_email: saleBuyerEmail.trim() || null,
          buyer_instagram: saleBuyerInstagram.trim() ? (saleBuyerInstagram.trim().startsWith('@') ? saleBuyerInstagram.trim() : `@${saleBuyerInstagram.trim()}`) : null,
          location: saleLocation.trim() || 'online',
          payment_type: salePaymentType,
          total_price: totalPrice,
          total_articles: totalArticlesCount,
          status: hasPrepurchase ? 'PRECOMPRA' : 'COMPLETADA',
        })
        .select()
        .single();

      if (saleError || !saleData) {
        throw new Error(`Error al registrar la venta: ${saleError?.message}`);
      }

      const itemsWithSaleId = itemsToInsert.map((item) => ({
        ...item,
        sale_id: saleData.id,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(itemsWithSaleId);

      if (itemsError) {
        throw new Error(`Error al registrar los detalles de la venta: ${itemsError.message}`);
      }

      for (const update of stockUpdates) {
        const { error: stockError } = await supabase
          .from('articles')
          .update({ quantity: update.quantity })
          .eq('id', update.id);

        if (stockError) {
          console.error(`Error updating stock for article ID ${update.id}:`, stockError);
        }
      }

      alert('¡Venta registrada con éxito!');
      setShowSaleSummary(false);
      setSaleBuyerInstagram('');
      setSelectedArticleIds([]);
      setSaleItemQuantities(new Map());
      setSaleItemPrices(new Map());
      
      await loadArticles();
      handleTabChange('sales');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al guardar la venta.');
    } finally {
      setRegisteringSale(false);
    }
  }

  // Filter list of select articles
  let selectArticles = articles;
  if (salesCreateSearch.trim()) {
    const query = salesCreateSearch.toLowerCase().trim();
    selectArticles = selectArticles.filter(a => 
      a.title.toLowerCase().includes(query) ||
      String(a.id).includes(query)
    );
  }

  let summaryTotal = 0;
  let summaryCount = 0;
  selectedArticleIds.forEach(id => {
    const art = articles.find(a => a.id === id);
    if (!art) return;
    const qty = getItemQuantity(id);
    const price = getItemPrice(id, art);
    summaryTotal += price * qty;
    summaryCount += qty;
  });

  return (
    <div className={styles.salesCreateContainer}>
      {/* Top Segmented Mode Control */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          padding: '6px',
          backgroundColor: 'var(--bg-card-glass)',
          border: '1px solid var(--border-card-glass)',
          borderRadius: '12px',
          maxWidth: '480px',
        }}
      >
        <button
          type="button"
          onClick={() => setSaleMode('tpv')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            backgroundColor: saleMode === 'tpv' ? '#6366f1' : 'transparent',
            color: saleMode === 'tpv' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s',
          }}
        >
          ⚡ Modo TPV (Ferias & Taller)
        </button>
        <button
          type="button"
          onClick={() => setSaleMode('detailed')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            backgroundColor: saleMode === 'detailed' ? '#6366f1' : 'transparent',
            color: saleMode === 'detailed' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s',
          }}
        >
          📋 Formulario Detallado
        </button>
      </div>

      {saleMode === 'tpv' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* TPV Success Modal / Banner */}
          {tpvLastSale && (
            <div
              style={{
                padding: '20px',
                borderRadius: '16px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1.5px solid #10b981',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#10b981' }}>
                  ✅ ¡Venta registrada con éxito en TPV!
                </span>
                <button
                  type="button"
                  onClick={() => setTpvLastSale(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Cerrar
                </button>
              </div>

              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Pedido: <strong>{tpvLastSale.orderNumber}</strong> · Total:{' '}
                <strong>{formatPrice(tpvLastSale.total)}</strong>
              </div>

              {tpvLastSale.phone && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <a
                    href={buildReceiptWhatsAppLink({
                      phone: tpvLastSale.phone,
                      buyerName: 'Cliente',
                      orderNumber: tpvLastSale.orderNumber,
                      items: tpvLastSale.items,
                      total: tpvLastSale.total,
                      shippingCost: 0,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      borderRadius: '10px',
                      backgroundColor: '#25D366',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '14px',
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span>📲 Enviar resguardo por WhatsApp</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Location & Quick Context */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '14px 18px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card-glass)',
              border: '1px solid var(--border-card-glass)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>📍 Ubicación venta:</span>
              <input
                type="text"
                value={tpvLocation}
                onChange={(e) => setTpvLocation(e.target.value)}
                placeholder="Ej. Feria del Coleccionismo León"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-page)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  minWidth: '220px',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setTpvLocation('Feria / Evento presencial')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                🎪 Feria
              </button>
              <button
                type="button"
                onClick={() => setTpvLocation('Taller León')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                🛠️ Taller
              </button>
            </div>
          </div>

          {/* Main 2-Column TPV Workspace */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
              alignItems: 'start',
            }}
          >
            {/* COLUMN 1: Article Catalog Selector */}
            <div
              style={{
                padding: '20px',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-card-glass)',
                border: '1px solid var(--border-card-glass)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  📦 Catálogo disponible ({articles.filter((a) => a.is_visible !== false && a.quantity > 0).length})
                </span>
              </div>

              <input
                type="text"
                placeholder="🔍 Buscar modelo, marca o ID..."
                value={tpvSearch}
                onChange={(e) => setTpvSearch(e.target.value)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-page)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '10px',
                  maxHeight: '520px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {articles
                  .filter((a) => {
                    if (a.is_visible === false || a.quantity <= 0) return false;
                    if (!tpvSearch.trim()) return true;
                    const q = tpvSearch.toLowerCase().trim();
                    return a.title.toLowerCase().includes(q) || String(a.id).includes(q);
                  })
                  .map((article) => {
                    const price = getFinalPriceForArticle(article);
                    const inCart = tpvCart.find((it) => it.article.id === article.id);
                    return (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => addTpvItem(article)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          padding: '10px',
                          borderRadius: '12px',
                          border: inCart ? '2px solid #6366f1' : '1px solid var(--border-card)',
                          backgroundColor: inCart ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-page)',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.15s ease-out',
                        }}
                      >
                        {inCart && (
                          <span
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              backgroundColor: '#6366f1',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 900,
                              borderRadius: '100px',
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {inCart.quantity}
                          </span>
                        )}

                        <div
                          style={{
                            width: '100%',
                            height: '75px',
                            position: 'relative',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            backgroundColor: '#111',
                            marginBottom: '6px',
                          }}
                        >
                          {article.image_urls?.[0] ? (
                            <Image
                              src={article.image_urls[0]}
                              alt={article.title}
                              fill
                              sizes="130px"
                              style={{ objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                              }}
                            >
                              🚗
                            </div>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            lineHeight: 1.2,
                            maxHeight: '2.4em',
                            overflow: 'hidden',
                            marginBottom: '4px',
                          }}
                        >
                          {article.title}
                        </span>

                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#10b981' }}>
                          {formatPrice(price)}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          Stock: {article.quantity}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* COLUMN 2: TPV Ticket & Instant Payment */}
            <div
              style={{
                padding: '20px',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-card-glass)',
                border: '1px solid var(--border-card-glass)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>
                  🧾 Ticket actual ({tpvCart.reduce((acc, it) => acc + it.quantity, 0)} uds.)
                </span>
                {tpvCart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTpvCart([])}
                    style={{
                      fontSize: '11px',
                      color: '#ef4444',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    Vaciar ticket
                  </button>
                )}
              </div>

              {/* Items in ticket list */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}
              >
                {tpvCart.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '24px 0', fontSize: '13px' }}>
                    Toca un artículo del catálogo para añadirlo al ticket.
                  </p>
                ) : (
                  tpvCart.map((item) => (
                    <div
                      key={item.article.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-page)',
                        border: '1px solid var(--border-card)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '10px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.article.title}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {formatPrice(item.price)} ud.
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => updateTpvQty(item.article.id, -1)}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-card)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                          }}
                        >
                          –
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: 800, minWidth: '18px', textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateTpvQty(item.article.id, 1)}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-card)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTpvItem(item.article.id)}
                          style={{
                            marginLeft: '6px',
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Total Display */}
              {(() => {
                const total = tpvCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
                const cashGiven = parseFloat(tpvCashGiven) || 0;
                const change = Math.max(0, cashGiven - total);
                const revolutCents = Math.round(total * 100);
                const revolutUrl = `https://revolut.me/jfernandezz?currency=EUR&amount=${revolutCents}&note=${encodeURIComponent(
                  `MEC Feria ${tpvLocation}`
                )}`;
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
                  revolutUrl
                )}`;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)' }}>TOTAL:</span>
                      <span style={{ fontSize: '28px', fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>
                        {formatPrice(total)}
                      </span>
                    </div>

                    {/* Payment Method Selector */}
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                        MÉTODO DE COBRO:
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setTpvPaymentType('EFECTIVO');
                            setShowQrModal(false);
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 8px',
                            borderRadius: '10px',
                            border: `1.5px solid ${tpvPaymentType === 'EFECTIVO' ? '#10b981' : 'var(--border-card)'}`,
                            backgroundColor: tpvPaymentType === 'EFECTIVO' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-page)',
                            color: tpvPaymentType === 'EFECTIVO' ? '#10b981' : 'var(--text-primary)',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          💵 Efectivo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTpvPaymentType('BIZUM');
                            setShowQrModal(true);
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 8px',
                            borderRadius: '10px',
                            border: `1.5px solid ${tpvPaymentType === 'BIZUM' ? '#6366f1' : 'var(--border-card)'}`,
                            backgroundColor: tpvPaymentType === 'BIZUM' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-page)',
                            color: tpvPaymentType === 'BIZUM' ? '#6366f1' : 'var(--text-primary)',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          📲 Bizum / QR
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTpvPaymentType('SQUARE');
                            setShowQrModal(false);
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 8px',
                            borderRadius: '10px',
                            border: `1.5px solid ${tpvPaymentType === 'SQUARE' ? '#06b6d4' : 'var(--border-card)'}`,
                            backgroundColor: tpvPaymentType === 'SQUARE' ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-page)',
                            color: tpvPaymentType === 'SQUARE' ? '#06b6d4' : 'var(--text-primary)',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          💳 Datáfono
                        </button>
                      </div>
                    </div>

                    {/* Cash change calculator if Efectivo */}
                    {tpvPaymentType === 'EFECTIVO' && total > 0 && (
                      <div
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--bg-page)',
                          border: '1px solid var(--border-card)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Entregado (€):</span>
                          <input
                            type="number"
                            placeholder="Ej. 50"
                            value={tpvCashGiven}
                            onChange={(e) => setTpvCashGiven(e.target.value)}
                            style={{
                              width: '90px',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-card)',
                              textAlign: 'right',
                              fontWeight: 'bold',
                              fontSize: '14px',
                            }}
                          />
                        </div>
                        {cashGiven > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '4px', borderTop: '1px dashed var(--border-card)' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Cambio a devolver:</span>
                            <span style={{ fontWeight: 900, color: cashGiven >= total ? '#10b981' : '#ef4444' }}>
                              {cashGiven >= total ? formatPrice(change) : 'Faltan ' + formatPrice(total - cashGiven)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* QR Code for Bizum / Revolut */}
                    {tpvPaymentType === 'BIZUM' && total > 0 && showQrModal && (
                      <div
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '10px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#111827' }}>
                          📲 Escanear para pagar con Bizum / Revolut:
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrUrl}
                          alt="QR Bizum Revolut"
                          width={200}
                          height={200}
                          style={{ borderRadius: '8px' }}
                        />
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                          Total preconfigurado: <strong>{formatPrice(total)}</strong>
                        </span>
                      </div>
                    )}

                    {/* Customer phone for WhatsApp receipt */}
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        📱 Móvil del cliente (opcional para recibo WhatsApp):
                      </span>
                      <input
                        type="tel"
                        placeholder="600 000 000"
                        value={tpvBuyerPhone}
                        onChange={(e) => setTpvBuyerPhone(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-card)',
                          backgroundColor: 'var(--bg-page)',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                        }}
                      />
                    </div>

                    {/* Checkout Button */}
                    <button
                      type="button"
                      onClick={handleTpvSale}
                      disabled={registeringSale || tpvCart.length === 0}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        fontSize: '16px',
                        fontWeight: 900,
                        cursor: registeringSale || tpvCart.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: registeringSale || tpvCart.length === 0 ? 0.6 : 1,
                        boxShadow: '0 8px 20px -4px rgba(16, 185, 129, 0.4)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {registeringSale ? '⏳ Registrando venta…' : `⚡ COBRAR Y DESCONTAR (${formatPrice(total)})`}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : (
        <>
        <div className={styles.salesCreateGrid}>
        <div className={styles.salesCreateCard}>
          <h2 className={styles.salesCardTitle}>1. Seleccionar Artículos</h2>
          
          <input
            type="text"
            placeholder="Buscar por marca, modelo o ID..."
            value={salesCreateSearch}
            onChange={(e) => setSalesCreateSearch(e.target.value)}
            className={styles.salesSearchInput}
            style={{ marginBottom: '16px' }}
          />

          <div className={styles.salesArticleSelectList}>
            {selectArticles.length === 0 ? (
              <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>No hay artículos que coincidan.</p>
            ) : (
              selectArticles.map(art => {
                const finalPrice = getFinalPriceForArticle(art);
                const isChecked = selectedArticleIds.includes(art.id);
                
                return (
                  <div 
                    key={art.id} 
                    className={`${styles.salesArticleSelectRow} ${isChecked ? styles.rowChecked : ''}`}
                    onClick={() => {
                      if (isChecked) {
                        setSelectedArticleIds(prev => prev.filter(id => id !== art.id));
                        setSaleItemQuantities(prev => {
                          const n = new Map(prev);
                          n.delete(art.id);
                          return n;
                        });
                        setSaleItemPrices(prev => {
                          const n = new Map(prev);
                          n.delete(art.id);
                          return n;
                        });
                      } else {
                        setSelectedArticleIds(prev => [...prev, art.id]);
                        setSaleItemQuantities(prev => {
                          const n = new Map(prev);
                          n.set(art.id, '1');
                          return n;
                        });
                        setSaleItemPrices(prev => {
                          const n = new Map(prev);
                          n.set(art.id, String(finalPrice));
                          return n;
                        });
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className={styles.salesCheckbox}
                    />
                    
                    {art.image_urls && art.image_urls[0] && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={art.image_urls[0]} 
                        alt={art.title} 
                        className={styles.selectRowThumb} 
                      />
                    )}

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{art.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '10px', marginTop: '2px' }}>
                        <span>Ref ID: MEC-{String(art.id).padStart(4, '0')}</span>
                        <span style={{ fontWeight: 'bold', color: art.quantity <= 0 ? 'var(--text-soldout)' : 'var(--text-available)' }}>
                          Stock: {art.quantity <= 0 ? `0 (Agotado)` : art.quantity}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ fontWeight: 'bold', fontSize: '14px', fontFamily: 'monospace' }}>
                      {formatPrice(finalPrice)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.salesCreateCard}>
          <h2 className={styles.salesCardTitle}>2. Detalles de Venta</h2>
          
          {selectedArticleIds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)', border: '1px dashed var(--border-card-glass)', borderRadius: '8px' }}>
              Selecciona artículos en el panel izquierdo para agregarlos a la venta.
            </div>
          ) : (
            <>
              <div className={styles.selectedItemsConfigList}>
                {selectedArticleIds.map(id => {
                  const art = articles.find(a => a.id === id);
                  if (!art) return null;

                  const officialPrice = getFinalPriceForArticle(art);
                  const priceStr = saleItemPrices.has(id) ? (saleItemPrices.get(id) ?? '') : String(officialPrice);
                  const customPriceNum = getItemPrice(id, art);
                  const isCustomPrice = saleItemPrices.has(id) && customPriceNum !== officialPrice;

                  const qtyStr = saleItemQuantities.has(id) ? (saleItemQuantities.get(id) ?? '') : '1';
                  const qtyNum = getItemQuantity(id);
                  const isPrepurchase = qtyNum > art.quantity;

                  return (
                    <div key={id} className={styles.configItemRow}>
                      <div className={styles.configItemInfo}>
                        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{art.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Ref ID: MEC-{String(art.id).padStart(4, '0')} | Precio oficial: {formatPrice(officialPrice)}
                        </div>
                        {isPrepurchase && (
                          <span className={styles.prepurchaseBadge}>
                            PRECOMPRA* (Falta stock. Disponible: {art.quantity})
                          </span>
                        )}
                      </div>

                      <div className={styles.configItemInputs}>
                        <div className={styles.inputFieldCompact}>
                          <label>Cant.</label>
                          <input
                            type="number"
                            min="1"
                            value={qtyStr}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSaleItemQuantities(prev => {
                                const n = new Map(prev);
                                n.set(id, val);
                                return n;
                              });
                            }}
                            className={styles.compactNumberInput}
                          />
                        </div>

                        <div className={styles.inputFieldCompact}>
                          <label>Precio €</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={priceStr}
                            placeholder={String(officialPrice)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSaleItemPrices(prev => {
                                const n = new Map(prev);
                                n.set(id, val);
                                return n;
                              });
                            }}
                            className={`${styles.compactNumberInput} ${isCustomPrice ? styles.customPriceActive : ''}`}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedArticleIds(prev => prev.filter(aid => aid !== id));
                            setSaleItemQuantities(prev => {
                              const n = new Map(prev);
                              n.delete(id);
                              return n;
                            });
                            setSaleItemPrices(prev => {
                              const n = new Map(prev);
                              n.delete(id);
                              return n;
                            });
                          }}
                          className={styles.removeItemBtn}
                          title="Quitar artículo"
                        >
                          ✕
                        </button>
                      </div>
                      {isCustomPrice && (
                        <div className={styles.priceWarningBanner}>
                          Aviso: El precio fijado ({formatPrice(customPriceNum)}) es {customPriceNum > officialPrice ? 'superior' : 'inferior'} al registrado ({formatPrice(officialPrice)})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '24px', borderTop: '1px solid var(--border-card-glass)', paddingTop: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className={styles.formLabel}>Teléfono Comprador (Opcional)</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      value={saleBuyerPhoneCode}
                      onChange={(e) => setSaleBuyerPhoneCode(e.target.value)}
                      className={styles.salesPrefixSelect}
                    >
                      <option value="+34">🇪🇸 +34</option>
                      <option value="+33">🇫🇷 +33</option>
                      <option value="+49">🇩🇪 +49</option>
                      <option value="+39">🇮🇹 +39</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+351">🇵🇹 +351</option>
                      <option value="+1">🇺🇸 +1</option>
                    </select>
                    <input
                      type="text"
                      placeholder="600000000"
                      value={saleBuyerPhone}
                      onChange={(e) => setSaleBuyerPhone(e.target.value)}
                      className={styles.salesTextInput}
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className={styles.formLabel}>Email Comprador (Opcional)</label>
                  <input
                    type="email"
                    placeholder="cliente@email.com"
                    value={saleBuyerEmail}
                    onChange={(e) => setSaleBuyerEmail(e.target.value)}
                    className={styles.salesTextInput}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className={styles.formLabel}>Instagram Comprador (Opcional)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                    <span style={{
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 10px',
                      background: '#f5f5f5',
                      border: '1px solid #d4d4d4',
                      borderRight: 'none',
                      borderRadius: '8px 0 0 8px',
                      fontSize: '16px',
                      lineHeight: 1,
                    }}>📸</span>
                    <input
                      type="text"
                      placeholder="@usuario"
                      value={saleBuyerInstagram}
                      onChange={(e) => setSaleBuyerInstagram(e.target.value)}
                      className={styles.salesTextInput}
                      style={{ borderRadius: '0 8px 8px 0' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <label className={styles.formLabel}>Localidad de venta</label>
                    <input
                      type="text"
                      value={saleLocation}
                      placeholder="online"
                      onChange={(e) => setSaleLocation(e.target.value)}
                      className={styles.salesTextInput}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <label className={styles.formLabel}>Tipo de Pago</label>
                    <select
                      value={salePaymentType}
                      onChange={(e) => setSalePaymentType(e.target.value as SalePaymentType)}
                      className={styles.salesTextInput}
                    >
                      <option value="BIZUM">Bizum / Transferencia</option>
                      <option value="PAYPAL">PayPal</option>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="RESERVA">Reserva</option>
                      <option value="SQUARE">Tarjeta (Square)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.createSaleTotalPanel}>
                  <div className={styles.summaryRow}>
                    <span>Total Artículos:</span>
                    <strong>{summaryCount} uds.</strong>
                  </div>
                  <div className={styles.summaryRow} style={{ fontSize: '16px', borderTop: '1px solid var(--border-card-glass)', paddingTop: '10px', marginTop: '6px' }}>
                    <span>Total Final:</span>
                    <strong style={{ fontFamily: 'monospace' }}>{formatPrice(summaryTotal)}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSaleSummary(true)}
                  className={styles.reviewSaleBtn}
                >
                  Revisar Venta
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Checkout Summary Modal */}
      {showSaleSummary && (() => {
        let summaryTotal = 0;
        let summaryCount = 0;
        let hasPrepurchase = false;
        const chosenItems: Array<{
          art: Article;
          qty: number;
          price: number;
          isPrepurchase: boolean;
        }> = [];

        selectedArticleIds.forEach(id => {
          const art = articles.find(a => a.id === id);
          if (!art) return;
          const qty = getItemQuantity(id);
          const price = getItemPrice(id, art);
          
          const isPrepurchase = salePaymentType === 'RESERVA' || qty > art.quantity;
          if (isPrepurchase) hasPrepurchase = true;

          summaryTotal += price * qty;
          summaryCount += qty;

          chosenItems.push({
            art,
            qty,
            price,
            isPrepurchase
          });
        });

        return (
          <div className={styles.modalOverlay}>
            <div className={styles.salesConfirmModal}>
              <h3 className={styles.modalTitle}>Confirmar Registro de Venta</h3>
              
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Por favor, revisa detalladamente el desglose antes de registrar la venta en el sistema.
              </p>

              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-card-glass)', borderRadius: '8px', marginBottom: '16px' }}>
                {chosenItems.map(({ art, qty, price, isPrepurchase }) => (
                  <div key={art.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-card-glass)', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{art.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID Ref: MEC-{String(art.id).padStart(4, '0')}</div>
                    </div>
                    
                    <div style={{ textWrap: 'nowrap', display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px' }}>
                        ud: <strong>{qty}</strong>{' '}
                        {isPrepurchase ? (
                          <span style={{ color: 'var(--text-soldout)', fontSize: '11px', fontWeight: 'bold' }}>
                            {salePaymentType === 'RESERVA' ? '(Reservado*)' : '(Precompra*)'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-available)', fontSize: '11px' }}>(Stock OK)</span>
                        )}
                      </span>
                      
                      <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px' }}>
                        {formatPrice(price * qty)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.confirmSummaryInfo}>
                <div className={styles.summaryRow}>
                  <span>Nº Artículos:</span>
                  <strong>{summaryCount} uds.</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Lugar de venta:</span>
                  <strong>{saleLocation || 'online'}</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Tipo de pago:</span>
                  <strong>{salePaymentType}</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Comprador:</span>
                  <strong>
                    {saleBuyerEmail || saleBuyerPhone || saleBuyerInstagram
                      ? `${saleBuyerEmail || ''}${saleBuyerPhone ? ` (${saleBuyerPhoneCode}${saleBuyerPhone})` : ''}${saleBuyerInstagram ? ` ${saleBuyerInstagram.startsWith('@') ? saleBuyerInstagram : '@' + saleBuyerInstagram}` : ''}`
                      : 'Venta Directa'}
                  </strong>
                </div>
                {saleBuyerInstagram && (
                  <div className={styles.summaryRow}>
                    <span>Instagram:</span>
                    <strong style={{ color: '#e1306c' }}>
                      {saleBuyerInstagram.startsWith('@') ? saleBuyerInstagram : `@${saleBuyerInstagram}`}
                    </strong>
                  </div>
                )}
                <div className={styles.summaryRow}>
                  <span>Estado venta:</span>
                  <strong style={{ color: hasPrepurchase ? 'var(--text-soldout)' : 'var(--text-available)' }}>
                    {salePaymentType === 'RESERVA' ? 'PENDIENTE' : (hasPrepurchase ? 'PRECOMPRA' : 'COMPLETADA')}
                  </strong>
                </div>
                
                <div className={styles.summaryRow} style={{ fontSize: '16px', borderTop: '2px solid var(--text-primary)', paddingTop: '10px', marginTop: '8px' }}>
                  <span>Total Venta:</span>
                  <strong style={{ fontFamily: 'monospace' }}>{formatPrice(summaryTotal)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={handleRegisterSale}
                  disabled={registeringSale}
                  className={`${styles.primaryButton} ${styles.solidGreenButton}`}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {registeringSale ? 'Procesando...' : 'Registrar Venta'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaleSummary(false)}
                  className={`${styles.dangerButton} ${styles.solidRedButton}`}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      </>
      )}
    </div>
  );
}
