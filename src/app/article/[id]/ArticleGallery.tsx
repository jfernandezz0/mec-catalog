'use client';

import Image from 'next/image';
import { useState } from 'react';
import styles from './article.module.css';

type ArticleGalleryProps = {
  imageUrls: string[];
  title: string;
};

export default function ArticleGallery({ imageUrls, title }: ArticleGalleryProps) {
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
    <section className={styles.galleryCard}>
      <div className={styles.heroImage}>
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt={`${title} image ${currentImage + 1}`}
              fill
              priority
              sizes="(max-width: 860px) 100vw, 58vw"
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
          <div className={styles.noImage}>No image</div>
        )}
      </div>

      {hasMultipleImages && (
        <div className={styles.thumbs} aria-label="Image thumbnails">
          {imageUrls.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              className={`${styles.thumb} ${
                index === currentImage ? styles.thumbActive : ''
              }`}
              onClick={() => setCurrentImage(index)}
              aria-label={`Show image ${index + 1}`}
            >
              <Image
                src={url}
                alt={`${title} thumbnail ${index + 1}`}
                fill
                sizes="96px"
                className={styles.thumbImage}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
