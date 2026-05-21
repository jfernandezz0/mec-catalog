'use client';

import { useState, useEffect, useRef } from 'react';
import ArticleCard from './ArticleCard';
import styles from './category.module.css';

type Article = {
  id: number;
  title: string;
  description: string | null;
  price: number | string;
  quantity: number;
  image_urls: string[] | null;
};

type InfiniteArticleGridProps = {
  articles: Article[];
};

export default function InfiniteArticleGrid({ articles }: InfiniteArticleGridProps) {
  const [visibleCount, setVisibleCount] = useState(12);
  const observerTargetRef = useRef<HTMLDivElement>(null);

  const visibleArticles = articles.slice(0, visibleCount);
  const hasMore = visibleCount < articles.length;

  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 12, articles.length));
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
  }, [hasMore, articles.length]);

  return (
    <>
      <section className={styles.grid}>
        {visibleArticles.map((article, index) => (
          <ArticleCard article={article} key={article.id} index={index} />
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
