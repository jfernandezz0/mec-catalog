'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Lightbox from '@/app/components/Lightbox';
import styles from './article.module.css';

type ArticleGalleryProps = {
  id: number;
  imageUrls: string[];
  frameImageUrls?: string[];
  title: string;
  countryCode?: string;
};

export default function ArticleGallery({ id, imageUrls, frameImageUrls = [], title, countryCode = '' }: ArticleGalleryProps) {
  const [activeImageTab, setActiveImageTab] = useState<'vehicle' | 'frame'>('vehicle');
  const [currentImage, setCurrentImage] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
  const hasFrameImages = frameImageUrls.length > 0;
  const displayedImages = activeImageTab === 'vehicle' ? imageUrls : frameImageUrls;
  
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

  function handleTabChange(tab: 'vehicle' | 'frame') {
    if (tab === activeImageTab) return;
    setActiveImageTab(tab);
    setCurrentImage(0);
  }

  const imageUrl = displayedImages[currentImage];
  const hasMultipleImages = displayedImages.length > 1;

  function showPreviousImage() {
    setCurrentImage((current) =>
      current === 0 ? displayedImages.length - 1 : current - 1,
    );
  }

  function showNextImage() {
    setCurrentImage((current) =>
      current === displayedImages.length - 1 ? 0 : current + 1,
    );
  }

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeOccurred = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
    swipeOccurred.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diffX = touchStartX.current - touchEndX.current;
    const threshold = 50; // pixels

    if (Math.abs(diffX) > threshold) {
      swipeOccurred.current = true;
      if (diffX > 0) {
        showNextImage();
      } else {
        showPreviousImage();
      }
      setTimeout(() => {
        swipeOccurred.current = false;
      }, 300);
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleHeroClick = (e: React.MouseEvent) => {
    if (swipeOccurred.current) {
      e.preventDefault();
      e.stopPropagation();
      swipeOccurred.current = false;
      return;
    }
    if (imageUrl) {
      setIsLightboxOpen(true);
    }
  };

  const countryUpper = countryCode.toUpperCase();

  return (
    <section className={`${styles.galleryCard} neon-card ${countryUpper ? `neon-card-${countryUpper}` : ''}`}>
      {hasFrameImages && (
        <div className={styles.galleryTabs}>
          <button
            type="button"
            className={`${styles.galleryTab} ${activeImageTab === 'vehicle' ? styles.galleryTabActive : ''}`}
            onClick={() => handleTabChange('vehicle')}
          >
            🚗 Vehículo MOC
          </button>
          <button
            type="button"
            className={`${styles.galleryTab} ${activeImageTab === 'frame' ? styles.galleryTabActive : ''}`}
            onClick={() => handleTabChange('frame')}
          >
            🖼️ Expositor con Luz
          </button>
        </div>
      )}

      <div 
        className={`${styles.heroImage} cursor-zoom-in`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleHeroClick}
      >
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt={`${title} image ${currentImage + 1}`}
              fill
              priority={currentImage === 0}
              sizes="(max-width: 860px) 100vw, 58vw"
              className={`${styles.image} ${activeImageTab === 'frame' ? styles.imageFrame : ''}`}
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
                  aria-label="Mostrar imagen anterior"
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
                  aria-label="Mostrar imagen siguiente"
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
                    <path d="M1.5 1.5L8.5 8L1.5 14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <span className={styles.imageCount} onClick={(e) => e.stopPropagation()}>
                  {currentImage + 1}/{displayedImages.length}
                </span>
              </>
            )}
          </>
        ) : (
          <div className={styles.noImage}>
            El fotógrafo se está tomando unos días libres.<br />
            🏖️☀️🍹
          </div>
        )}
      </div>

      {hasMultipleImages && (
        <div className={styles.thumbs} aria-label="Miniaturas de imágenes">
          {displayedImages.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              className={`${styles.thumb} ${
                index === currentImage ? styles.thumbActive : ''
              }`}
              onClick={() => setCurrentImage(index)}
              aria-label={`Mostrar imagen ${index + 1}`}
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
          imageUrls={displayedImages}
          initialIndex={currentImage}
          onClose={() => setIsLightboxOpen(false)}
          title={title}
        />
      )}
    </section>
  );
}
