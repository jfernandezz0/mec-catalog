'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { getFlagEmoji, formatPrice } from '@/lib/utils';
import { Article, Category } from '@/lib/types';
import styles from '../admin.module.css';

interface CatalogTabProps {
  articles: Article[];
  categories: Category[];
  loadingArticles: boolean;
  selectedCatalogCategoryId: number | null;
  setSelectedCatalogCategoryId: (id: number | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: 'catalog' | 'create' | 'edit' | 'categories' | 'import' | 'config' | 'sales' | 'sales-create' | 'analytics' | 'generate_list') => void;
  moveArticle: (id: number, direction: 'up' | 'down', displayed: Article[]) => void;
  startEditing: (article: Article) => void;
}

export default function CatalogTab({
  articles,
  categories,
  loadingArticles,
  selectedCatalogCategoryId,
  setSelectedCatalogCategoryId,
  searchQuery,
  setSearchQuery,
  setActiveTab,
  moveArticle,
  startEditing,
}: CatalogTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Reset page when search or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCatalogCategoryId, searchQuery]);

  let displayedArticles = selectedCatalogCategoryId === null
    ? articles
    : articles.filter((a) => a.category_id === selectedCatalogCategoryId);

  if (searchQuery.trim()) {
    const query = searchQuery.trim().toLowerCase();
    displayedArticles = displayedArticles.filter((a) => {
      const idString = String(a.id);
      const formattedRefCode = `mec-${idString.padStart(4, '0')}`;
      const titleMatch = a.title.toLowerCase().includes(query);
      const descMatch = a.description?.toLowerCase().includes(query) || false;
      const idMatch = idString === query || formattedRefCode.includes(query) || idString.includes(query);
      return idMatch || titleMatch || descMatch;
    });
  }

  // Pagination calculations
  const totalItems = displayedArticles.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const activePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedArticles = displayedArticles.slice(startIndex, endIndex);

  return (
    <div>
      {/* Category filter submenu */}
      {!loadingArticles && categories.length > 0 && (
        <div className={styles.catalogCategoryFilter}>
          <button
            type="button"
            className={`${styles.catalogCategoryPill} ${selectedCatalogCategoryId === null ? styles.catalogCategoryPillActive : ''}`}
            onClick={() => setSelectedCatalogCategoryId(null)}
          >
            Todas
            <span className={styles.catalogPillCount}>{articles.length}</span>
          </button>
          {categories.map((cat) => {
            const count = articles.filter((a) => a.category_id === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                className={`${styles.catalogCategoryPill} ${selectedCatalogCategoryId === cat.id ? styles.catalogCategoryPillActive : ''}`}
                onClick={() => setSelectedCatalogCategoryId(cat.id)}
              >
                {getFlagEmoji(cat.country_code)} {cat.name}
                <span className={styles.catalogPillCount}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search Bar */}
      {!loadingArticles && (
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.searchIcon}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por ID (ej. 42), marca o modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={styles.searchClear}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {loadingArticles ? (
        <div className={styles.loading}>Cargando catálogo...</div>
      ) : paginatedArticles.length > 0 ? (
        <div>
          <div className={styles.catalogGrid}>
            {paginatedArticles.map((article) => {
              const catName =
                categories.find((c) => c.id === article.category_id)?.name ||
                'Sin categoría';
              const primaryImageUrl =
                article.image_urls && article.image_urls.length > 0
                  ? article.image_urls[0]
                  : null;

              return (
                <article key={article.id} className={styles.catalogCard}>
                  <div className={styles.cardImageWrap}>
                    {primaryImageUrl ? (
                      <Image
                        src={primaryImageUrl}
                        alt={article.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 400px"
                        className={styles.cardImage}
                      />
                    ) : (
                      <div className={styles.cardNoImage}>
                        El fotógrafo se está tomando unos días libres.<br />
                        🏖️☀️🍹
                      </div>
                    )}
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardInfoCol}>
                        <span className={styles.cardCategory}>
                          {catName} <span className={styles.cardIdBadge}>ID: {article.id}</span>
                        </span>
                        {(() => {
                          const parts = article.title.split(' – ');
                          const marca = parts[0];
                          const modelo = parts.slice(1).join(' – ');
                          return modelo ? (
                            <h2 className={styles.cardTitle}>
                              <span className={styles.cardBrand}>{marca}</span>
                              <span>{modelo}</span>
                            </h2>
                          ) : (
                            <h2 className={styles.cardTitle}>{article.title}</h2>
                          );
                        })()}
                      </div>
                      <div className={styles.cardStatsRow}>
                        <span className={styles.cardViews} title="Visualizaciones de la ficha">
                          👁️ {article.views ?? 0}
                        </span>
                        <span className={styles.cardClicks} title="Clics de contacto recibidos">
                          📞 {article.contact_clicks ?? 0}
                        </span>
                        <span className={styles.cardShareClicks} title="Clics de compartir recibidos">
                          🔗 {article.share_clicks ?? 0}
                        </span>
                      </div>
                    </div>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardPrice}>
                        {formatPrice(article.price)}
                      </span>
                      <div className="flex gap-2 items-center">
                        <span className={styles.cardStock}>
                          {article.quantity} ud.
                        </span>
                      </div>
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.cardOrderButton}
                        onClick={() => moveArticle(article.id, 'up', displayedArticles)}
                        aria-label="Subir"
                        title="Subir en esta categoría"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.cardOrderButton}
                        onClick={() => moveArticle(article.id, 'down', displayedArticles)}
                        aria-label="Bajar"
                        title="Bajar en esta categoría"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={styles.cardEditButton}
                        onClick={() => startEditing(article)}
                      >
                        Abrir Ficha / Editar
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className={styles.paginationRow} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '25px', padding: '10px 0' }}>
              <button
                type="button"
                disabled={activePage === 1}
                onClick={() => setCurrentPage(activePage - 1)}
                className={styles.paginationButton}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-card)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: activePage === 1 ? 'not-allowed' : 'pointer',
                  opacity: activePage === 1 ? 0.5 : 1,
                  fontWeight: 'bold',
                  fontSize: '13px',
                  transition: 'opacity 0.2s ease'
                }}
              >
                Anterior
              </button>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                Página {activePage} de {totalPages}
              </span>
              <button
                type="button"
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage(activePage + 1)}
                className={styles.paginationButton}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-card)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: activePage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: activePage === totalPages ? 0.5 : 1,
                  fontWeight: 'bold',
                  fontSize: '13px',
                  transition: 'opacity 0.2s ease'
                }}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      ) : articles.length > 0 ? (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>Sin artículos en esta categoría</h2>
          <p className={styles.emptyText}>
            Aún no has añadido artículos aquí. Crea uno y asígnalo a esta categoría.
          </p>
          <button
            type="button"
            className={styles.emptyButton}
            onClick={() => setActiveTab('create')}
          >
            Crear artículo
          </button>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>Catálogo vacío</h2>
          <p className={styles.emptyText}>
            Aún no has añadido ningún artículo al catálogo digital.
          </p>
          <button
            type="button"
            className={styles.emptyButton}
            onClick={() => setActiveTab('create')}
          >
            Crear primer artículo
          </button>
        </div>
      )}
    </div>
  );
}
