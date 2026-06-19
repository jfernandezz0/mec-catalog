'use client';

import { useState } from 'react';
import { getFlagEmoji, formatPrice } from '@/lib/utils';
import { calculateDiscount } from '@/lib/discounts';
import { Article, Category } from '@/lib/types';
import styles from '../admin.module.css';

interface PDFListGeneratorProps {
  articles: Article[];
  categories: Category[];
  generalDiscountPercent: string;
}

export default function PDFListGenerator({
  articles,
  categories,
  generalDiscountPercent,
}: PDFListGeneratorProps) {
  // Local states
  const [listStockFilter, setListStockFilter] = useState<'todos' | 'stock' | 'sin_stock'>('todos');
  const [listShowPhotos, setListShowPhotos] = useState(true);
  const [listShowPrices, setListShowPrices] = useState(true);

  // Sorting
  const sortedArticles = [...articles].sort((a, b) => a.id - b.id);
  
  // Filtering
  const filteredArticles = sortedArticles.filter(article => {
    if (listStockFilter === 'stock') {
      return article.quantity > 0;
    } else if (listStockFilter === 'sin_stock') {
      return article.quantity === 0;
    }
    return true;
  });

  const handleGeneratePdf = () => {
    window.print();
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .print-only {
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
            width: 1px !important;
            height: 1px !important;
            overflow: hidden !important;
          }
        }
        @media print {
          .no-print,
          .fixed,
          [class*="fixed"] {
            display: none !important;
          }
          .print-only {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: auto !important;
            height: auto !important;
            display: block !important;
            overflow: visible !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-family: system-ui, -apple-system, sans-serif !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 15px !important;
          }
          th, td {
            border: 1px solid #cccccc !important;
            padding: 6px 8px !important;
            text-align: left !important;
            font-size: 11px !important;
            color: #000000 !important;
          }
          th {
            background-color: #f3f4f6 !important;
            font-weight: bold !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          @page {
            size: A4;
            margin: 5mm;
          }
        }
      `}} />

      <div className={styles.paymentsCard} style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 className={styles.paymentsCardTitle}>📋 Generar Listado para Inventario</h2>
        <p className={styles.paymentsCardDesc} style={{ marginBottom: '24px' }}>
          Configura los filtros para generar un documento PDF optimizado para impresión y control rápido de inventario.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. Stock Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              1. Filtro de artículos por stock:
            </label>
            <select
              value={listStockFilter}
              onChange={(e) => setListStockFilter(e.target.value as any)}
              className={styles.salesTextInput}
              style={{ padding: '10px', fontSize: '14px' }}
            >
              <option value="todos">Todos los artículos</option>
              <option value="stock">Solo artículos con stock</option>
              <option value="sin_stock">Solo artículos sin stock</option>
            </select>
          </div>

          {/* 2. Show Photos */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-card)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>2. Incluir fotos en el listado</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Muestra una miniatura de la imagen del artículo</span>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
              <input
                type="checkbox"
                checked={listShowPhotos}
                onChange={(e) => setListShowPhotos(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  inset: 0,
                  backgroundColor: listShowPhotos ? '#22c55e' : '#ccc',
                  borderRadius: '24px',
                  transition: '0.3s',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: listShowPhotos ? '22px' : '4px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: '0.3s',
                }}
              />
            </label>
          </div>

          {/* 3. Show Prices and Discounts */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-card)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>3. Incluir precios y descuentos</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Muestra el precio oficial, descuento aplicado y precio final</span>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
              <input
                type="checkbox"
                checked={listShowPrices}
                onChange={(e) => setListShowPrices(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  inset: 0,
                  backgroundColor: listShowPrices ? '#22c55e' : '#ccc',
                  borderRadius: '24px',
                  transition: '0.3s',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: listShowPrices ? '22px' : '4px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: '0.3s',
                }}
              />
            </label>
          </div>

          {/* Info summary */}
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-card)', fontSize: '13px', color: 'var(--text-secondary)' }}>
            📊 El listado contendrá <strong>{filteredArticles.length}</strong> artículos ordenados por ID.
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGeneratePdf}
            className={styles.paymentsRetryButton}
            style={{
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-page)',
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 150ms ease'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Generar Listado PDF
          </button>
        </div>
      </div>

      {/* PDF Container (only visible during print, pre-loaded in screen mode offscreen) */}
      <div className="print-only">
        <div style={{ padding: '0px', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '16px' }}>
            <div>
              <h1 style={{ fontSize: '20px', margin: 0, fontWeight: 'bold', color: '#000' }}>Control de Inventario</h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#444' }}>
                MiniEngines Creations &middot; {new Date().toLocaleDateString('es-ES')}
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '10px', color: '#444' }}>
              Filtro: {listStockFilter === 'stock' ? 'Solo con stock' : listStockFilter === 'sin_stock' ? 'Solo sin stock' : 'Todos'} &middot; Total: {filteredArticles.length} arts.
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: '10%' }}>ID</th>
                <th style={{ width: '20%' }}>Categoría / País</th>
                <th>Nombre del Artículo</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Stock</th>
                {listShowPhotos && <th style={{ width: '26%', textAlign: 'center' }}>Foto</th>}
                {listShowPrices && <th style={{ width: '9%', textAlign: 'right' }}>Precio</th>}
              </tr>
            </thead>
            <tbody>
              {filteredArticles.map((article) => {
                const category = categories.find((c) => c.id === article.category_id);
                const catName = category ? `${getFlagEmoji(category.country_code)} ${category.name}` : 'Sin categoría';
                const primaryImageUrl = article.image_urls && article.image_urls.length > 0 ? article.image_urls[0] : null;
                
                // Calculate discount
                const discInfo = calculateDiscount(
                  article.price,
                  article.discount_type,
                  article.discount_value,
                  category?.discount_percent,
                  generalDiscountPercent
                );

                return (
                  <tr key={article.id}>
                    <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                      MEC-{String(article.id).padStart(4, '0')}
                    </td>
                    <td>{catName}</td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{article.title}</div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: article.quantity === 0 ? 'bold' : 'normal', color: article.quantity === 0 ? '#cc0000' : '#000' }}>
                      {article.quantity} ud.
                    </td>
                    {listShowPhotos && (
                      <td style={{ textAlign: 'center', padding: '4px' }}>
                        {primaryImageUrl ? (
                          <img
                            src={primaryImageUrl}
                            alt={article.title}
                            style={{ width: '100%', maxWidth: '160px', height: 'auto', maxHeight: '120px', objectFit: 'contain', border: '1px solid #eee', borderRadius: '4px', display: 'block', margin: '0 auto' }}
                          />
                        ) : (
                          <span style={{ fontSize: '9px', color: '#999' }}>Sin foto</span>
                        )}
                      </td>
                    )}
                    {listShowPrices && (
                      <td style={{ textAlign: 'right' }}>
                        {discInfo.discountAmount > 0 ? (
                          <div>
                            <div style={{ textDecoration: 'line-through', color: '#666', fontSize: '9px' }}>
                              {formatPrice(discInfo.originalPrice)}
                            </div>
                            <div style={{ fontWeight: 'bold' }}>
                              {formatPrice(discInfo.finalPrice)}
                            </div>
                            <div style={{ fontSize: '9px', color: '#008800', fontWeight: 'bold' }}>
                              -{discInfo.discountType === 'percentage' ? `${discInfo.discountValue}%` : formatPrice(discInfo.discountAmount)}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontWeight: 'bold' }}>
                            {formatPrice(discInfo.originalPrice)}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
