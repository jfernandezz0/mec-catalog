'use client';

import React from 'react';
import styles from '../admin.module.css';
import { getFlagEmoji } from '@/lib/utils';
import { Category, Article } from '@/lib/types';

interface ConfigTabProps {
  // Payment settings
  paymentsEnabled: boolean;
  bizumEnabled: boolean;
  paypalEnabled: boolean;
  squareEnabled: boolean;
  hidePrices: boolean;
  hideAvailability: boolean;
  loadingPaymentsSetting: boolean;
  hasSettingsTable: boolean;
  // Discounts
  hasDiscountColumns: boolean;
  generalDiscountPercent: string;
  categories: Category[];
  articles: Article[];
  // Callbacks
  togglePayments: (enabled: boolean) => void;
  toggleBizum: (enabled: boolean) => void;
  togglePaypal: (enabled: boolean) => void;
  toggleSquare: (enabled: boolean) => void;
  toggleHidePrices: (enabled: boolean) => void;
  toggleHideAvailability: (enabled: boolean) => void;
  loadPaymentsSetting: () => void;
  handleSaveDiscount: (event: React.FormEvent) => void;
  handleDeleteDiscount: (target: 'general' | number) => void;
  // Discount form state
  selectedDiscountTarget: string;
  setSelectedDiscountTarget: (target: string) => void;
  targetDiscountPercent: string;
  setTargetDiscountPercent: (val: string) => void;
  savingDiscount: boolean;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  syncingCatalog?: boolean;
  syncingCatalogForce?: boolean;
  handleSyncSquareCatalog?: (force: boolean) => void;
}

export default function ConfigTab({
  paymentsEnabled,
  bizumEnabled,
  paypalEnabled,
  squareEnabled,
  hidePrices,
  hideAvailability,
  loadingPaymentsSetting,
  hasSettingsTable,
  hasDiscountColumns,
  generalDiscountPercent,
  categories,
  articles,
  togglePayments,
  toggleBizum,
  togglePaypal,
  toggleSquare,
  toggleHidePrices,
  toggleHideAvailability,
  loadPaymentsSetting,
  handleSaveDiscount,
  handleDeleteDiscount,
  selectedDiscountTarget,
  setSelectedDiscountTarget,
  targetDiscountPercent,
  setTargetDiscountPercent,
  savingDiscount,
  setCategories,
  syncingCatalog = false,
  syncingCatalogForce = false,
  handleSyncSquareCatalog,
}: ConfigTabProps) {
  return (
          <div className={styles.paymentsSection} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Sección 1: Pagos */}
            <div className={styles.paymentsCard}>
              <h2 className={styles.paymentsCardTitle}>Pagos</h2>
              <p className={styles.paymentsCardDesc}>
                Ajustes de Métodos de Pago Online
              </p>

              {loadingPaymentsSetting ? (
                <div className={styles.paymentsLoading}>Cargando estado de los ajustes...</div>
              ) : !hasSettingsTable ? (
                <div className={styles.paymentsWarning}>
                  <h3>⚠️ Configuración requerida en base de datos</h3>
                  <p>
                    La tabla <code>settings</code> no existe todavía en tu base de datos de Supabase.
                    Para activar esta funcionalidad, copia y ejecuta el siguiente código en el <strong>SQL Editor</strong> de tu panel de Supabase:
                  </p>
                  <pre className={styles.paymentsSqlBlock}>
{`CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(255) PRIMARY KEY,
  value VARCHAR(255) NOT NULL
);

INSERT INTO settings (key, value)
VALUES 
  ('payments_enabled', 'false'),
  ('revolut_enabled', 'true'),
  ('paypal_enabled', 'true'),
  ('hide_prices', 'false'),
  ('hide_availability', 'false')
ON CONFLICT (key) DO NOTHING;`}
                  </pre>
                  <button
                    type="button"
                    onClick={loadPaymentsSetting}
                    className={styles.paymentsRetryButton}
                  >
                    Recargar ajuste
                  </button>
                </div>
              ) : (
                <div className={styles.paymentsList}>
                  {/* Master Switch */}
                  <div className={`${styles.paymentsToggleRow} ${hidePrices ? styles.disabledRow : ''}`}>
                    <div className={styles.paymentsToggleText}>
                      <span className={styles.paymentsToggleLabel}>
                        General - Metodos de pago online
                      </span>
                      <span className={styles.paymentsToggleSublabel}>
                        {hidePrices
                          ? 'Inhabilitado — Los precios de los artículos están ocultos.'
                          : paymentsEnabled 
                          ? 'Activo — Se mostrarán los botones de compra seleccionados abajo.' 
                          : 'Inactivo — Se ocultan todos los botones de pago directo en toda la web.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={hidePrices}
                      onClick={() => togglePayments(!paymentsEnabled)}
                      className={`${styles.switch} ${paymentsEnabled && !hidePrices ? styles.switchActive : ''}`}
                      aria-label="Alternar todos los métodos de pago"
                      title="Alternar todos los métodos de pago"
                    >
                      <span className={styles.switchHandle} />
                    </button>
                  </div>

                  {/* Bizum Switch */}
                  <div className={`${styles.paymentsToggleRow} ${(!paymentsEnabled || hidePrices) ? styles.disabledRow : ''}`}>
                    <div className={styles.paymentsToggleText}>
                      <span className={styles.paymentsToggleLabel}>
                        Bizum / Transferencia
                      </span>
                      <span className={styles.paymentsToggleSublabel}>
                        Muestra el botón de pago Bizum / transferencia personal.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!paymentsEnabled || hidePrices}
                      onClick={() => toggleBizum(!bizumEnabled)}
                      className={`${styles.switch} ${bizumEnabled && paymentsEnabled && !hidePrices ? styles.switchActive : ''}`}
                      aria-label="Alternar Bizum"
                      title="Alternar Bizum"
                    >
                      <span className={styles.switchHandle} />
                    </button>
                  </div>

                  {/* PayPal Switch */}
                  <div className={`${styles.paymentsToggleRow} ${(!paymentsEnabled || hidePrices) ? styles.disabledRow : ''}`}>
                    <div className={styles.paymentsToggleText}>
                      <span className={styles.paymentsToggleLabel}>
                        Pago Online PayPal
                      </span>
                      <span className={styles.paymentsToggleSublabel}>
                        Muestra el botón de compra que redirige a la pasarela de PayPal con el importe y concepto del artículo.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!paymentsEnabled || hidePrices}
                      onClick={() => togglePaypal(!paypalEnabled)}
                      className={`${styles.switch} ${paypalEnabled && paymentsEnabled && !hidePrices ? styles.switchActive : ''}`}
                      aria-label="Alternar PayPal"
                      title="Alternar PayPal"
                    >
                      <span className={styles.switchHandle} />
                    </button>
                  </div>

                  {/* Square (Pago con tarjeta) Switch */}
                  <div className={`${styles.paymentsToggleRow} ${(!paymentsEnabled || hidePrices) ? styles.disabledRow : ''}`}>
                    <div className={styles.paymentsToggleText}>
                      <span className={styles.paymentsToggleLabel}>
                        💳 Pago con tarjeta (Square)
                      </span>
                      <span className={styles.paymentsToggleSublabel}>
                        Activa el checkout con tarjeta mediante Square. Requiere credenciales de Square configuradas en .env.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!paymentsEnabled || hidePrices}
                      onClick={() => toggleSquare(!squareEnabled)}
                      className={`${styles.switch} ${squareEnabled && paymentsEnabled && !hidePrices ? styles.switchActive : ''}`}
                      aria-label="Alternar pago con tarjeta Square"
                      title="Alternar pago con tarjeta Square"
                    >
                      <span className={styles.switchHandle} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sección 1.5: Sincronización Square Catalog */}
            <div className={styles.paymentsCard}>
              <h2 className={styles.paymentsCardTitle}>Sincronización de Catálogo</h2>
              <p className={styles.paymentsCardDesc}>
                Sincroniza tus artículos disponibles con tu catálogo de Square para ventas presenciales (Tap to Pay).
              </p>
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <button
                    type="button"
                    disabled={syncingCatalog || syncingCatalogForce || !squareEnabled}
                    onClick={() => handleSyncSquareCatalog && handleSyncSquareCatalog(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: 'bold',
                      cursor: syncingCatalog || syncingCatalogForce || !squareEnabled ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      background: syncingCatalog ? 'var(--text-secondary)' : '#6366f1',
                      color: '#fff',
                      opacity: !squareEnabled ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {syncingCatalog ? '🔄 Sincronizando...' : '🔄 Sincronizar pendientes'}
                  </button>

                  <button
                    type="button"
                    disabled={syncingCatalog || syncingCatalogForce || !squareEnabled}
                    onClick={() => handleSyncSquareCatalog && handleSyncSquareCatalog(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: 'bold',
                      cursor: syncingCatalog || syncingCatalogForce || !squareEnabled ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      background: syncingCatalogForce ? 'var(--text-secondary)' : 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                      color: '#fff',
                      opacity: !squareEnabled ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {syncingCatalogForce ? '⚡ Forzando sincronización completa...' : '⚡ Forzar sincronización completa (con fotos)'}
                  </button>
                </div>
                {!squareEnabled && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#ef4444' }}>
                    ⚠️ Activa el pago con tarjeta Square arriba para habilitar la sincronización.
                  </p>
                )}
              </div>
            </div>

            {/* Sección 2: Visibilidad */}
            <div className={styles.paymentsCard}>
              <h2 className={styles.paymentsCardTitle}>Visibilidad</h2>
              <p className={styles.paymentsCardDesc}>
                Opciones de visualización de precios y disponibilidad
              </p>

              {loadingPaymentsSetting ? (
                <div className={styles.paymentsLoading}>Cargando estado de los ajustes...</div>
              ) : (
                <div className={styles.paymentsList}>
                  {/* Hide Prices Switch */}
                  <div className={styles.paymentsToggleRow}>
                    <div className={styles.paymentsToggleText}>
                      <span className={styles.paymentsToggleLabel}>
                        Mostrar precios de artículos
                      </span>
                      <span className={styles.paymentsToggleSublabel}>
                        {!hidePrices
                          ? 'Activo — Los precios se mostrarán en la ficha y en el listado de artículos.'
                          : 'Inactivo — Los precios no se mostrarán en la ficha ni en el listado de artículos.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleHidePrices(!hidePrices)}
                      className={`${styles.switch} ${!hidePrices ? styles.switchActive : ''}`}
                      aria-label="Alternar mostrar precios de artículos"
                      title="Alternar mostrar precios de artículos"
                    >
                      <span className={styles.switchHandle} />
                    </button>
                  </div>

                  {/* Hide Availability Switch */}
                  <div className={styles.paymentsToggleRow}>
                    <div className={styles.paymentsToggleText}>
                      <span className={styles.paymentsToggleLabel}>
                        Mostrar información de disponibilidad
                      </span>
                      <span className={styles.paymentsToggleSublabel}>
                        {!hideAvailability
                          ? 'Activo — La disponibilidad de stock se mostrará en la ficha del artículo.'
                          : 'Inactivo — La disponibilidad de stock no se mostrará en la ficha del artículo.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleHideAvailability(!hideAvailability)}
                      className={`${styles.switch} ${!hideAvailability ? styles.switchActive : ''}`}
                      aria-label="Alternar mostrar información de disponibilidad"
                      title="Alternar mostrar información de disponibilidad"
                    >
                      <span className={styles.switchHandle} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sección 3: Descuentos Masivos */}
            <div className={styles.paymentsCard}>
              <h2 className={styles.paymentsCardTitle}>Configuración de descuentos:</h2>
              <p className={styles.paymentsCardDesc}>
                Aplica descuentos de porcentaje (%) a toda la web o por categorías de origen.
              </p>

              {!hasDiscountColumns ? (
                <div className={styles.paymentsWarning}>
                  <h3>⚠️ Configuración requerida en base de datos</h3>
                  <p>
                    Para usar esta sección de descuentos, es necesario añadir las columnas de descuento en tu base de datos de Supabase.
                    Copia y ejecuta el siguiente código en el <strong>SQL Editor</strong> de tu panel de Supabase y recarga:
                  </p>
                  <pre className={styles.paymentsSqlBlock}>
{`ALTER TABLE articles ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('percentage', 'amount'));
ALTER TABLE articles ADD COLUMN IF NOT EXISTS discount_value NUMERIC;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS discount_percent INTEGER CHECK (discount_percent >= 1 AND discount_percent <= 100);`}
                  </pre>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className={styles.paymentsRetryButton}
                  >
                    Recargar página
                  </button>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSaveDiscount} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
                    <label className={styles.field}>
                      <span className={styles.labelRow}>
                        <span>Seleccionar objetivo del descuento</span>
                        <span className={styles.hint}>Requerido</span>
                      </span>
                      <select
                        value={selectedDiscountTarget}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedDiscountTarget(val);
                          if (val === 'general') {
                            setTargetDiscountPercent(generalDiscountPercent);
                          } else if (val.startsWith('cat-')) {
                            const catId = Number(val.substring(4));
                            const cat = categories.find(c => c.id === catId);
                            setTargetDiscountPercent(cat?.discount_percent ? String(cat.discount_percent) : '');
                          } else {
                            setTargetDiscountPercent('');
                          }
                        }}
                        className={styles.control}
                        required
                      >
                        <option value="">Selecciona una opción...</option>
                        <option value="general">General (Toda la Web)</option>
                        <option value="separator" disabled>────────────────────</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={`cat-${cat.id}`}>
                            {getFlagEmoji(cat.country_code)} {cat.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedDiscountTarget && selectedDiscountTarget !== 'separator' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Priority Warning alert if applicable */}
                        {(() => {
                          if (selectedDiscountTarget === 'general') {
                            const hasArticleDiscounts = articles.some(a => a.discount_type);
                            const hasCategoryDiscounts = categories.some(c => c.discount_percent);
                            if (hasArticleDiscounts || hasCategoryDiscounts) {
                              return (
                                <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)', color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.45' }}>
                                  ⚠️ Nota: Hay artículos o categorías con descuentos específicos (prioridad superior) que no se verán afectados por este descuento general a menos que su descuento específico sea menor.
                                </div>
                              );
                            }
                          } else if (selectedDiscountTarget.startsWith('cat-')) {
                            const catId = Number(selectedDiscountTarget.substring(4));
                            const hasArticleDiscounts = articles.some(a => a.category_id === catId && a.discount_type);
                            if (hasArticleDiscounts) {
                              return (
                                <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)', color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.45' }}>
                                  ⚠️ Nota: Hay artículos en esta categoría con descuento individual (prioridad superior) que no se verán afectados por este descuento de categoría a menos que su descuento específico sea menor.
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                          <div>
                            <span style={{ fontWeight: '700', fontSize: '14px', display: 'block' }}>Activar descuento</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              Habilita el descuento para {selectedDiscountTarget === 'general' ? 'toda la web' : 'esta categoría'}.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetDiscountPercent(targetDiscountPercent ? '' : '10');
                            }}
                            className={`${styles.switch} ${targetDiscountPercent ? styles.switchActive : ''}`}
                            title="Alternar descuento"
                            style={{ flexShrink: 0, marginLeft: '12px' }}
                          >
                            <span className={styles.switchHandle} />
                          </button>
                        </div>

                        {targetDiscountPercent !== '' && (
                          <label className={styles.field} style={{ borderLeft: '3px solid var(--border-card)', paddingLeft: '16px' }}>
                            <span className={styles.labelRow}>
                              <span>Porcentaje de descuento (%)</span>
                              <span className={styles.hint}>Valor entero de 1 a 100</span>
                            </span>
                            <input
                              type="number"
                              value={targetDiscountPercent}
                              onChange={(e) => setTargetDiscountPercent(e.target.value)}
                              min="1"
                              max="100"
                              step="1"
                              required
                              placeholder="Ej: 10"
                              className={styles.control}
                              disabled={savingDiscount}
                            />
                          </label>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDiscountTarget('');
                              setTargetDiscountPercent('');
                            }}
                            className={styles.secondaryButton}
                            disabled={savingDiscount}
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className={styles.primaryButton}
                            disabled={savingDiscount}
                          >
                            {savingDiscount ? 'Guardando...' : 'Guardar Descuento'}
                          </button>
                        </div>
                      </div>
                    )}
                  </form>

                  {/* Active Discounts List merged directly here */}
                  <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-card)', paddingTop: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '14px', color: 'var(--text-primary)' }}>
                      Descuentos Masivos Activos
                    </h3>
                    {(() => {
                      const activeGeneral = generalDiscountPercent && Number(generalDiscountPercent) > 0;
                      const activeCategories = categories.filter(c => c.discount_percent && c.discount_percent > 0);
                      
                      if (!activeGeneral && activeCategories.length === 0) {
                        return (
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                            No hay descuentos generales ni de categoría activos actualmente.
                          </p>
                        );
                      }
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {activeGeneral && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              borderRadius: '10px',
                              background: 'var(--bg-card-glass)',
                              border: '1px solid var(--border-card-glass)'
                            }}>
                              <div>
                                <span style={{ fontWeight: '850', fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>
                                  🌍 Descuento General (Toda la Web)
                                </span>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                  Porcentaje: <strong>{generalDiscountPercent}%</strong>
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={savingDiscount}
                                onClick={() => handleDeleteDiscount('general')}
                                className={`${styles.dangerButtonSmall} ${styles.solidRedButton}`}
                                style={{ padding: '8px 14px', height: 'auto', borderRadius: '6px', fontSize: '12px', fontWeight: '800' }}
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                          
                          {activeCategories.map(cat => (
                            <div key={cat.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              borderRadius: '10px',
                              background: 'var(--bg-card-glass)',
                              border: '1px solid var(--border-card-glass)'
                            }}>
                              <div>
                                <span style={{ fontWeight: '850', fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>
                                  {getFlagEmoji(cat.country_code)} Categoría: {cat.name}
                                </span>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                  Porcentaje: <strong>{cat.discount_percent}%</strong>
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={savingDiscount}
                                onClick={() => handleDeleteDiscount(cat.id)}
                                className={`${styles.dangerButtonSmall} ${styles.solidRedButton}`}
                                style={{ padding: '8px 14px', height: 'auto', borderRadius: '6px', fontSize: '12px', fontWeight: '800' }}
                              >
                                Eliminar
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>
  );
}
