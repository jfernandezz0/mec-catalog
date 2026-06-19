'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import { Article, Sale, StatsSnapshot } from '@/lib/types';
import styles from '../admin.module.css';

interface AnalyticsTabProps {
  articles: Article[];
  sales: Sale[];
  loadArticles: () => Promise<void>;
}

export default function AnalyticsTab({
  articles,
  sales,
  loadArticles,
}: AnalyticsTabProps) {
  // Local states
  const [statsSnapshots, setStatsSnapshots] = useState<StatsSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodNameInput, setPeriodNameInput] = useState('');
  const [savingPeriod, setSavingPeriod] = useState(false);

  // Load snapshots on mount
  useEffect(() => {
    loadSnapshots();
  }, []);

  async function loadSnapshots() {
    setLoadingSnapshots(true);
    try {
      const { data, error } = await supabase
        .from('stats_snapshots')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) {
        setStatsSnapshots(data ?? []);
      }
    } catch (e) {
      // Table may not exist yet — fail silently
    } finally {
      setLoadingSnapshots(false);
    }
  }

  async function handleNewPeriod() {
    const name = periodNameInput.trim();
    if (!name) {
      alert('Por favor introduce un nombre para el período.');
      return;
    }
    setSavingPeriod(true);
    try {
      // Calculate current totals from articles
      const totalViews = articles.reduce((s, a) => s + (a.views || 0), 0);
      const totalContactClicks = articles.reduce((s, a) => s + (a.contact_clicks || 0), 0);
      const totalShareClicks = articles.reduce((s, a) => s + (a.share_clicks || 0), 0);

      // Save snapshot
      const { error: insertError } = await supabase
        .from('stats_snapshots')
        .insert({
          period_name: name,
          total_views: totalViews,
          total_contact_clicks: totalContactClicks,
          total_share_clicks: totalShareClicks,
          article_count: articles.length,
        });

      if (insertError) {
        if ((insertError as any).code === '42P01' || insertError.message.includes('does not exist')) {
          alert('La tabla stats_snapshots no existe aún en Supabase. Ejecuta el SQL del plan primero.');
        } else {
          alert(`Error al guardar el snapshot:\n\n${insertError.message}\n\nCódigo: ${(insertError as any).code || 'N/A'}`);
        }
        return;
      }

      // Reset all article counters to 0
      const { error: resetError } = await supabase
        .from('articles')
        .update({ views: 0, contact_clicks: 0, share_clicks: 0 })
        .gte('id', 0);

      if (resetError) throw resetError;

      alert(`¡Período "${name}" guardado con éxito! Los contadores se han reiniciado.`);
      setShowPeriodModal(false);
      setPeriodNameInput('');
      await loadArticles();
      await loadSnapshots();
    } catch (e: any) {
      alert(`Error al guardar el período: ${e.message || e}`);
    } finally {
      setSavingPeriod(false);
    }
  }

  // Computing stats
  const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);
  const totalContactClicks = articles.reduce((sum, a) => sum + (a.contact_clicks || 0), 0);
  const totalShareClicks = articles.reduce((sum, a) => sum + (a.share_clicks || 0), 0);
  const conversionRate = totalViews > 0 ? ((totalContactClicks / totalViews) * 100).toFixed(2) : '0';
  const totalSalesCount = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_price), 0);
  const averageTicket = totalSalesCount > 0 ? (totalRevenue / totalSalesCount) : 0;

  const topViews = [...articles]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5);

  const topContact = [...articles]
    .sort((a, b) => (b.contact_clicks || 0) - (a.contact_clicks || 0))
    .slice(0, 5);

  const topConversion = articles
    .filter((a) => (a.views || 0) >= 5)
    .map((a) => ({
      ...a,
      rate: ((a.contact_clicks || 0) / (a.views || 1)) * 100
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  const maxViews = Math.max(...topViews.map(a => a.views || 1), 1);
  const maxClicks = Math.max(...topContact.map(a => a.contact_clicks || 1), 1);
  const maxConversion = Math.max(...topConversion.map(a => a.rate || 1), 1);

  const revenueByPayment = sales.reduce((acc, s) => {
    const type = s.payment_type || 'OTRO';
    acc[type] = (acc[type] || 0) + Number(s.total_price);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={styles.analyticsContainer}>
      {/* Header con botón de nuevo período */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Período actual · desde el último reset
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setPeriodNameInput(''); setShowPeriodModal(true); }}
          className={styles.newPeriodBtn}
        >
          📅 Iniciar nuevo período
        </button>
      </div>

      {/* Tarjetas Métricas Globales */}
      <div className={styles.analyticsGrid}>
        <div className={styles.analyticsCard}>
          <span className={styles.analyticsCardLabel}>Visitas Totales</span>
          <span className={styles.analyticsCardValue}>{totalViews}</span>
          <span className={styles.analyticsCardSubtext}>Interacciones con artículos</span>
        </div>
        <div className={styles.analyticsCard}>
          <span className={styles.analyticsCardLabel}>Clics de WhatsApp</span>
          <span className={styles.analyticsCardValue}>{totalContactClicks}</span>
          <span className={styles.analyticsCardSubtext}>Conversión a contacto</span>
        </div>
        <div className={styles.analyticsCard}>
          <span className={styles.analyticsCardLabel}>Veces Compartido</span>
          <span className={styles.analyticsCardValue}>{totalShareClicks}</span>
          <span className={styles.analyticsCardSubtext}>Compartición del catálogo</span>
        </div>
        <div className={styles.analyticsCard}>
          <span className={styles.analyticsCardLabel}>Conversión Interés</span>
          <span className={styles.analyticsCardValue}>{conversionRate}%</span>
          <span className={styles.analyticsCardSubtext}>Ratio Clics / Visitas</span>
        </div>
      </div>

      {/* Panel de Rendimiento de Ventas Histórico */}
      <div className={styles.analyticsSalesCard}>
        <h3 className={styles.sectionTitle}>Métricas Financieras Consolidadas</h3>
        <div className={styles.analyticsSalesGrid}>
          <div className={styles.analyticsSalesMetric}>
            <span className={styles.analyticsSalesLabel}>Ingresos Históricos</span>
            <span className={styles.analyticsSalesValue}>{formatPrice(totalRevenue)}</span>
          </div>
          <div className={styles.analyticsSalesMetric}>
            <span className={styles.analyticsSalesLabel}>Ventas Registradas</span>
            <span className={styles.analyticsSalesValue}>{totalSalesCount} uds.</span>
          </div>
          <div className={styles.analyticsSalesMetric}>
            <span className={styles.analyticsSalesLabel}>Ticket Medio</span>
            <span className={styles.analyticsSalesValue}>{formatPrice(averageTicket)}</span>
          </div>
          <div className={styles.analyticsSalesMetric}>
            <span className={styles.analyticsSalesLabel}>Métodos de Pago</span>
            <div className={styles.analyticsSalesPayments}>
              <div className={styles.payRow}>
                <span>Revolut:</span>
                <strong>{formatPrice(revenueByPayment['REVOLUT'] || 0)}</strong>
              </div>
              <div className={styles.payRow}>
                <span>PayPal:</span>
                <strong>{formatPrice(revenueByPayment['PAYPAL'] || 0)}</strong>
              </div>
              <div className={styles.payRow}>
                <span>Efectivo:</span>
                <strong>{formatPrice(revenueByPayment['EFECTIVO'] || 0)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Artículos TOP */}
      <div className={styles.topArticlesGrid}>
        {/* TOP Visitas */}
        <div className={styles.topArticlesCard}>
          <h3 className={styles.sectionTitle}>Top 5 Artículos Más Vistos</h3>
          <div className={styles.topArticlesList}>
            {topViews.map((art) => {
              const percentage = ((art.views || 0) / maxViews) * 100;
              return (
                <div key={art.id} className={styles.topArticleRow}>
                  <div className={styles.topArticleInfo}>
                    <span className={styles.topArticleTitle}>{art.title}</span>
                    <span className={styles.topArticleValue}>{art.views || 0} visitas</span>
                  </div>
                  <div className={styles.progressBarContainer}>
                    <div className={styles.progressBar} style={{ width: `${percentage}%`, backgroundColor: '#1d4ed8' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TOP Interés (Clics de Contacto) */}
        <div className={styles.topArticlesCard}>
          <h3 className={styles.sectionTitle}>Top 5 Mayor Interés de Compra</h3>
          <div className={styles.topArticlesList}>
            {topContact.map((art) => {
              const percentage = ((art.contact_clicks || 0) / maxClicks) * 100;
              return (
                <div key={art.id} className={styles.topArticleRow}>
                  <div className={styles.topArticleInfo}>
                    <span className={styles.topArticleTitle}>{art.title}</span>
                    <span className={styles.topArticleValue}>{art.contact_clicks || 0} clics</span>
                  </div>
                  <div className={styles.progressBarContainer}>
                    <div className={styles.progressBar} style={{ width: `${percentage}%`, backgroundColor: '#15803d' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TOP Ratio de Conversión */}
        <div className={styles.topArticlesCard}>
          <h3 className={styles.sectionTitle}>Top 5 Ratios de Conversión (Visita a Clic)</h3>
          <div className={styles.topArticlesList}>
            {topConversion.map((art) => {
              const percentage = (art.rate / maxConversion) * 100;
              return (
                <div key={art.id} className={styles.topArticleRow}>
                  <div className={styles.topArticleInfo}>
                    <span className={styles.topArticleTitle}>{art.title}</span>
                    <span className={styles.topArticleValue}>{art.rate.toFixed(1)}% ratio</span>
                  </div>
                  <div className={styles.progressBarContainer}>
                    <div className={styles.progressBar} style={{ width: `${percentage}%`, backgroundColor: '#ea580c' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historial de Períodos */}
      {statsSnapshots.length > 0 && (
        <div className={styles.periodHistoryCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className={styles.sectionTitle} style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>🗂️ Historial de Períodos</h3>
            <span style={{ fontSize: '12px', color: '#a3a3a3' }}>{statsSnapshots.length} período{statsSnapshots.length !== 1 ? 's' : ''} guardado{statsSnapshots.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.snapshotTable}>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Fecha cierre</th>
                  <th style={{ textAlign: 'right' }}>Visitas</th>
                  <th style={{ textAlign: 'right' }}>Clics WA</th>
                  <th style={{ textAlign: 'right' }}>Compartidos</th>
                  <th style={{ textAlign: 'right' }}>Artículos</th>
                  <th style={{ textAlign: 'right' }}>Conv. %</th>
                </tr>
              </thead>
              <tbody>
                {statsSnapshots.map((snap) => {
                  const convRate = snap.total_views > 0
                    ? ((snap.total_contact_clicks / snap.total_views) * 100).toFixed(1)
                    : '0.0';
                  return (
                    <tr key={snap.id} className={styles.snapshotRow}>
                      <td style={{ fontWeight: 750 }}>{snap.period_name}</td>
                      <td style={{ color: '#737373', fontSize: '12px' }}>
                        {new Date(snap.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{snap.total_views.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{snap.total_contact_clicks.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{snap.total_share_clicks.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', color: '#737373' }}>{snap.article_count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: Number(convRate) >= 5 ? '#16a34a' : Number(convRate) >= 2 ? '#d97706' : '#737373' }}>
                        {convRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Período */}
      {showPeriodModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPeriodModal(false)}>
          <div className={styles.periodModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>📅 Iniciar nuevo período</h3>
            <p style={{ fontSize: '13px', color: '#525252', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Se guardará un snapshot de las estadísticas actuales y los contadores de visitas, clics y compartidos se pondrán a cero para empezar a medir el nuevo período.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nombre del período
              </label>
              <input
                type="text"
                placeholder="Ej: Mayo 2026, Temporada verano..."
                value={periodNameInput}
                onChange={(e) => setPeriodNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !savingPeriod && handleNewPeriod()}
                className={styles.salesTextInput}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={handleNewPeriod}
                disabled={savingPeriod || !periodNameInput.trim()}
                className={`${styles.primaryButton} ${styles.solidGreenButton}`}
                style={{ flex: 1 }}
              >
                {savingPeriod ? 'Guardando...' : '✓ Guardar y resetear'}
              </button>
              <button
                type="button"
                onClick={() => setShowPeriodModal(false)}
                className={styles.secondaryButton}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
