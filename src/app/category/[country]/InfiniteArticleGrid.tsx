'use client';

import { useState, useEffect, useRef } from 'react';
import ArticleCard from './ArticleCard';
import styles from './category.module.css';
import { calculateDiscount } from '@/lib/discounts';
import { Article } from '@/lib/types';



type InfiniteArticleGridProps = {
  articles: Article[];
  hidePrices?: boolean;
  hideAvailability?: boolean;
  categoryDiscountPercent?: number | null;
  generalDiscountPercent?: string;
  countryCode?: string;
};

export default function InfiniteArticleGrid({ 
  articles, 
  hidePrices = false, 
  hideAvailability = false,
  categoryDiscountPercent = null,
  generalDiscountPercent = '',
  countryCode = ''
}: InfiniteArticleGridProps) {
  const [visibleCount, setVisibleCount] = useState(12);
  const [sortBy, setSortBy] = useState<string>('default');
  const [layoutMode, setLayoutMode] = useState<'default' | 'alternate'>('default');
  const observerTargetRef = useRef<HTMLDivElement>(null);

  // Sort articles based on selection
  const sortedArticles = [...articles].sort((a, b) => {
    if (sortBy === 'default') {
      return 0;
    }
    
    if (sortBy.startsWith('alpha-')) {
      const partsA = a.title.split(' – ');
      const brandA = partsA[0] || '';
      const modelA = partsA.slice(1).join(' – ') || '';

      const partsB = b.title.split(' – ');
      const brandB = partsB[0] || '';
      const modelB = partsB.slice(1).join(' – ') || '';

      const brandCompare = brandA.localeCompare(brandB, 'es', { sensitivity: 'base' });
      if (brandCompare !== 0) {
        return sortBy === 'alpha-asc' ? brandCompare : -brandCompare;
      }
      const modelCompare = modelA.localeCompare(modelB, 'es', { sensitivity: 'base' });
      return sortBy === 'alpha-asc' ? modelCompare : -modelCompare;
    }
    
    if (sortBy.startsWith('price-')) {
      const priceA = calculateDiscount(
        a.price,
        a.discount_type,
        a.discount_value,
        categoryDiscountPercent,
        generalDiscountPercent
      ).finalPrice;
      
      const priceB = calculateDiscount(
        b.price,
        b.discount_type,
        b.discount_value,
        categoryDiscountPercent,
        generalDiscountPercent
      ).finalPrice;

      return sortBy === 'price-asc' ? priceA - priceB : priceB - priceA;
    }
    
    return 0;
  });

  const finalArticlesToRender = sortBy === 'default' ? articles : sortedArticles;
  const visibleArticles = finalArticlesToRender.slice(0, visibleCount);
  const hasMore = visibleCount < finalArticlesToRender.length;

  useEffect(() => {
    // Reset visible count when sorting options change
    setVisibleCount(12);
  }, [sortBy]);

  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 12, finalArticlesToRender.length));
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const target = observerTargetRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, finalArticlesToRender.length]);

  return (
    <>
      <div className={styles.controlsBar}>
        <div className={styles.controlsLeft}>
          <span className={styles.controlsLabel}>Ordenar:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={styles.sortSelect}
          >
            <option value="default">Por defecto</option>
            <option value="alpha-asc">Nombre: A - Z</option>
            <option value="alpha-desc">Nombre: Z - A</option>
            <option value="price-asc">Precio: Menor a Mayor</option>
            <option value="price-desc">Precio: Mayor a Menor</option>
          </select>
        </div>
        
        <button
          type="button"
          onClick={() => setLayoutMode(prev => prev === 'default' ? 'alternate' : 'default')}
          className={`${styles.layoutButton} ${layoutMode === 'alternate' ? styles.layoutButtonActive : ''}`}
          title={layoutMode === 'alternate' ? 'Vista clásica' : 'Vista compacta'}
          aria-label="Cambiar distribución de columnas"
        >
          {layoutMode === 'alternate' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" />
              <rect x="14" y="3" width="7" height="5" />
              <rect x="14" y="12" width="7" height="9" />
              <rect x="3" y="16" width="7" height="5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="18" />
              <rect x="14" y="3" width="7" height="18" />
            </svg>
          )}
        </button>
      </div>

      <section className={`${styles.grid} ${layoutMode === 'alternate' ? styles.alternateGrid : ''}`}>
        {visibleArticles.map((article, index) => (
          <ArticleCard 
            article={article} 
            key={article.id} 
            index={index} 
            hidePrices={hidePrices} 
            hideAvailability={hideAvailability} 
            categoryDiscountPercent={categoryDiscountPercent}
            generalDiscountPercent={generalDiscountPercent}
            countryCode={countryCode}
          />
        ))}
      </section>

      {hasMore && (
        <div ref={observerTargetRef} className={styles.loaderContainer}>
          <div className={styles.spinner}>Cargando más artículos...</div>
        </div>
      )}
    </>
  );
}
