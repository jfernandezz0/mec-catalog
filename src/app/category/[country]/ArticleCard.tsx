'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import styles from './category.module.css';

type ArticleCardProps = {
  article: {
    id: number;
    title: string;
    description: string | null;
    price: number | string;
    quantity: number;
    image_urls: string[] | null;
  };
  index?: number;
};

function formatPrice(value: number | string) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value));
}

export default function ArticleCard({ article, index }: ArticleCardProps) {
  const imageUrls = article.image_urls?.filter(Boolean) ?? [];
  const [currentImage, setCurrentImage] = useState(0);
  const imageUrl = imageUrls[currentImage];
  const hasMultipleImages = imageUrls.length > 1;

  function showPreviousImage() {
    setCurrentImage((current) =>
      current === 0 ? imageUrls.length - 1 : current - 1,
    );
  }

  function showNextImage() {
    setCurrentImage((current) =>
      current === imageUrls.length - 1 ? 0 : current + 1,
    );
  }

  return (
    <article 
      className={styles.card}
      style={index !== undefined ? { animationDelay: `${index * 60}ms` } : undefined}
    >
      <div className={styles.imageWrap}>
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt={`${article.title} image ${currentImage + 1}`}
              fill
              sizes="(max-width: 560px) 100vw, (max-width: 820px) 50vw, 33vw"
              className={styles.image}
            />

            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  className={`${styles.imageButton} ${styles.prevButton}`}
                  onClick={showPreviousImage}
                  aria-label="Show previous image"
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
                    <path d="M8.5 1.5L1.5 8L8.5 14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  type="button"
                  className={`${styles.imageButton} ${styles.nextButton}`}
                  onClick={showNextImage}
                  aria-label="Show next image"
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
                    <path d="M1.5 1.5L8.5 8L1.5 14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <span className={styles.imageCount}>
                  {currentImage + 1}/{imageUrls.length}
                </span>
                {/* Dots inside imageWrap as overlay */}
                <div className={styles.dots} aria-label="Image selector">
                  {imageUrls.map((url, index) => (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      className={`${styles.dot} ${
                        index === currentImage ? styles.dotActive : ''
                      }`}
                      onClick={() => setCurrentImage(index)}
                      aria-label={`Show image ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className={styles.noImage}>Sin imagen</div>
        )}
      </div>

      <div className={styles.content}>
        {(() => {
          const parts = article.title.split(' – ');
          const marca = parts[0];
          const modelo = parts.slice(1).join(' – ');
          return modelo ? (
            <h2 className={styles.cardTitle}>
              <span className={styles.cardMarca}>{marca}</span>
              <span className={styles.cardModelo}>{modelo}</span>
            </h2>
          ) : (
            <h2 className={styles.cardTitle}>{article.title}</h2>
          );
        })()}

        <div className={styles.metaRow}>
          <span className={styles.price}>{formatPrice(article.price)}</span>
          <span className={article.quantity === 0 ? styles.stockOut : styles.stockIn}>
            {article.quantity === 0 ? 'Agotado' : 'Disponible'}
          </span>
        </div>
        <Link href={`/article/${article.id}`} className={styles.detailLink}>
          Ver ficha
        </Link>
      </div>
    </article>
  );
}
