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
};

function formatPrice(value: number | string) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value));
}

export default function ArticleCard({ article }: ArticleCardProps) {
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
    <article className={styles.card}>
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
                  ‹
                </button>
                <button
                  type="button"
                  className={`${styles.imageButton} ${styles.nextButton}`}
                  onClick={showNextImage}
                  aria-label="Show next image"
                >
                  ›
                </button>
                <span className={styles.imageCount}>
                  {currentImage + 1}/{imageUrls.length}
                </span>
              </>
            )}
          </>
        ) : (
          <div className={styles.noImage}>Sin imagen</div>
        )}
      </div>

      {hasMultipleImages && (
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
      )}

      <div className={styles.content}>
        <h2 className={styles.cardTitle}>{article.title}</h2>

        <div className={styles.metaRow}>
          <span className={styles.price}>{formatPrice(article.price)}</span>
          <span className={article.quantity === 0 ? styles.stockOut : styles.stock}>
            {article.quantity === 0 ? 'Agotado' : `${article.quantity} en stock`}
          </span>
        </div>
        <Link href={`/article/${article.id}`} className={styles.detailLink}>
          Ver ficha
        </Link>
      </div>
    </article>
  );
}
