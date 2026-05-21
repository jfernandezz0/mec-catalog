'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Lightbox from '@/app/components/Lightbox';
import styles from './article.module.css';

type ArticleGalleryProps = {
  id: number;
  imageUrls: string[];
  title: string;
};

export default function ArticleGallery({ id, imageUrls, title }: ArticleGalleryProps) {
  const [currentImage, setCurrentImage] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
  useEffect(() => {
    window.scrollTo(0, 0);
    
    const registerPageView = async () => {
      try {
        await supabase.rpc('increment_article_views', { article_id: id });
      } catch (err) {
        console.error('Error incrementing article views:', err);
      }
    };
    registerPageView();
  }, [id]);

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
      <div 
        className={`${styles.heroImage} cursor-zoom-in`}
        onClick={() => imageUrl && setIsLightboxOpen(true)}
      >
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
                  onClick={(e) => {
                    e.stopPropagation();
                    showPreviousImage();
                  }}
                  aria-label="Show previous image"
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
                    <path d="M8.5 1.5L1.5 8L8.5 14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  type="button"
                  className={`${styles.imageButton} ${styles.nextButton}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    showNextImage();
                  }}
                  aria-label="Show next image"
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
                    <path d="M1.5 1.5L8.5 8L1.5 14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <span className={styles.imageCount} onClick={(e) => e.stopPropagation()}>
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

      {isLightboxOpen && (
        <Lightbox
          imageUrls={imageUrls}
          initialIndex={currentImage}
          onClose={() => setIsLightboxOpen(false)}
          title={title}
        />
      )}
    </section>
  );
}
