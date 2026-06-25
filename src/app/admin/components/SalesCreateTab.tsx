'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import { calculateDiscount } from '@/lib/discounts';
import { Article, Category, AdminTab } from '@/lib/types';
import styles from '../admin.module.css';

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
  // Local states
  const [selectedArticleIds, setSelectedArticleIds] = useState<number[]>([]);
  const [saleItemQuantities, setSaleItemQuantities] = useState<Map<number, number>>(new Map());
  const [saleItemPrices, setSaleItemPrices] = useState<Map<number, number>>(new Map());
  const [saleBuyerPhoneCode, setSaleBuyerPhoneCode] = useState('+34');
  const [saleBuyerPhone, setSaleBuyerPhone] = useState('');
  const [saleBuyerEmail, setSaleBuyerEmail] = useState('');
  const [saleBuyerInstagram, setSaleBuyerInstagram] = useState('');
  const [saleLocation, setSaleLocation] = useState('online');
  const [salePaymentType, setSalePaymentType] = useState<'REVOLUT' | 'PAYPAL' | 'EFECTIVO' | 'RESERVA'>('REVOLUT');
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

  async function handleRegisterSale() {
    if (selectedArticleIds.length === 0) {
      alert('Debes seleccionar al menos un artículo.');
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

      const itemsToInsert: any[] = [];
      const stockUpdates: Array<{ id: number; quantity: number }> = [];

      for (const id of selectedArticleIds) {
        const article = articles.find((a) => a.id === id);
        if (!article) continue;

        const qty = saleItemQuantities.get(id) || 1;
        const customPrice = saleItemPrices.has(id)
          ? (saleItemPrices.get(id) ?? 0)
          : getFinalPriceForArticle(article);

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
          quantity: article.quantity - qty,
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
    } catch (e: any) {
      alert(e.message || 'Error al guardar la venta.');
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
    const qty = saleItemQuantities.get(id) || 1;
    const price = saleItemPrices.has(id)
      ? (saleItemPrices.get(id) ?? 0)
      : getFinalPriceForArticle(art);
    summaryTotal += price * qty;
    summaryCount += qty;
  });

  return (
    <div className={styles.salesCreateContainer}>
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
                      } else {
                        setSelectedArticleIds(prev => [...prev, art.id]);
                        setSaleItemQuantities(prev => {
                          const n = new Map(prev);
                          n.set(art.id, 1);
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

                  const qty = saleItemQuantities.get(id) || 1;
                  const officialPrice = getFinalPriceForArticle(art);
                  const customPrice = saleItemPrices.has(id) ? (saleItemPrices.get(id) ?? 0) : officialPrice;
                  const isCustomPrice = saleItemPrices.has(id) && saleItemPrices.get(id) !== officialPrice;
                  const isPrepurchase = qty > art.quantity;

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
                            value={qty}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
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
                            value={customPrice}
                            placeholder={String(officialPrice)}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
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
                          onClick={() => setSelectedArticleIds(prev => prev.filter(aid => aid !== id))}
                          className={styles.removeItemBtn}
                          title="Quitar artículo"
                        >
                          ✕
                        </button>
                      </div>
                      {isCustomPrice && (
                        <div className={styles.priceWarningBanner}>
                          Aviso: El precio fijado ({formatPrice(customPrice)}) es {customPrice > officialPrice ? 'superior' : 'inferior'} al registrado ({formatPrice(officialPrice)})
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
                      onChange={(e: any) => setSalePaymentType(e.target.value)}
                      className={styles.salesTextInput}
                    >
                      <option value="REVOLUT">Revolut</option>
                      <option value="PAYPAL">PayPal</option>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="RESERVA">Reserva</option>
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
        const chosenItems: any[] = [];

        selectedArticleIds.forEach(id => {
          const art = articles.find(a => a.id === id);
          if (!art) return;
          const qty = saleItemQuantities.get(id) || 1;
          const price = saleItemPrices.has(id)
            ? (saleItemPrices.get(id) ?? 0)
            : getFinalPriceForArticle(art);
          
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
    </div>
  );
}
