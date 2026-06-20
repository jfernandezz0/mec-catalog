'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { calculateDiscount } from '@/lib/discounts';
import { formatPrice } from '@/lib/utils';
import { useSwipe } from '@/lib/hooks/useSwipe';
import { ShareIcon } from '@/app/components/Icons';
import ShareDropdown from '@/app/components/ShareDropdown';
import styles from './category.module.css';

type ArticleCardProps = {
  article: {
    id: number;
    title: string;
    description: string | null;
    price: number | string;
    quantity: number;
    image_urls: string[] | null;
    frame_image_urls?: string[] | null;
    discount_type?: string | null;
    discount_value?: number | null;
  };
  index?: number;
  hidePrices?: boolean;
  hideAvailability?: boolean;
  categoryDiscountPercent?: number | null;
  generalDiscountPercent?: string;
  countryCode?: string;
};



export default function ArticleCard({ 
  article, 
  index, 
  hidePrices = false, 
  hideAvailability = false,
  categoryDiscountPercent = null,
  generalDiscountPercent = '',
  countryCode = ''
}: ArticleCardProps) {
  const isPriceHidden = hidePrices || article.quantity <= 0;
  const imageUrls = article.image_urls?.filter(Boolean) ?? [];
  const [currentImage, setCurrentImage] = useState(0);
  const imageUrl = imageUrls[currentImage];
  const hasMultipleImages = imageUrls.length > 1;

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const shareRef = useRef<HTMLDivElement>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const articleUrl = `${origin}/article/${article.id}`;

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastMsg(successMessage);
      setTimeout(() => setToastMsg(''), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard: ', err);
    }
  };

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

  const { onTouchStart, onTouchMove, onTouchEnd, swipeOccurred } = useSwipe({
    onSwipeLeft: showNextImage,
    onSwipeRight: showPreviousImage,
  });

  const handleLinkClick = (e: React.MouseEvent) => {
    if (swipeOccurred.current) {
      e.preventDefault();
      e.stopPropagation();
      swipeOccurred.current = false;
    }
  };

  const countryUpper = countryCode.toUpperCase();

  return (
    <article 
      className={`${styles.card} ${isShareOpen ? styles.cardActiveShare : ''} neon-card ${countryUpper ? `neon-card-${countryUpper}` : ''}`}
      style={index !== undefined ? { animationDelay: `${index * 60}ms` } : undefined}
    >
      <div className={styles.imageWrap}>
        {imageUrl ? (
          <>
            <Link 
              href={`/article/${article.id}`} 
              className={styles.imageLink} 
              aria-label={`Ver ficha de ${article.title}`}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onClick={handleLinkClick}
            >
              <Image
                src={imageUrl}
                alt={`${article.title} image ${currentImage + 1}`}
                fill
                sizes="(max-width: 560px) 100vw, (max-width: 820px) 50vw, 33vw"
                className={styles.image}
              />
            </Link>

            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  className={`${styles.imageButton} ${styles.prevButton}`}
                  onClick={showPreviousImage}
                  aria-label="Mostrar imagen anterior"
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
                    <path d="M8.5 1.5L1.5 8L8.5 14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  type="button"
                  className={`${styles.imageButton} ${styles.nextButton}`}
                  onClick={showNextImage}
                  aria-label="Mostrar imagen siguiente"
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
                    <path d="M1.5 1.5L8.5 8L1.5 14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <span className={styles.imageCount}>
                  {currentImage + 1}/{imageUrls.length}
                </span>
                {/* Dots inside imageWrap as overlay */}
                <div className={styles.dots} aria-label="Selector de imágenes">
                  {imageUrls.map((url, index) => (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      className={`${styles.dot} ${
                        index === currentImage ? styles.dotActive : ''
                      }`}
                      onClick={() => setCurrentImage(index)}
                      aria-label={`Mostrar imagen ${index + 1}`}
                    />
                  ))}
                </div>
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

      <div className={styles.content}>
        <div className={styles.titleRow}>
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
          <div className={styles.cardShareContainer} ref={shareRef}>
            <button
              onClick={() => setIsShareOpen(!isShareOpen)}
              className={`${styles.cardShareBtn} ${isShareOpen ? styles.cardShareBtnActive : ''}`}
              title="Compartir artículo"
              aria-expanded={isShareOpen}
            >
              <ShareIcon className={styles.shareIcon} />
            </button>

            <ShareDropdown
              id={article.id}
              title={article.title}
              url={articleUrl}
              isOpen={isShareOpen}
              onClose={() => setIsShareOpen(false)}
              onCopySuccess={(msg) => setToastMsg(msg)}
              parentRef={shareRef}
              copyMessage="¡Enlace copiado!"
              classes={{
                dropdown: styles.cardDropdown,
                dropdownItem: styles.cardDropdownItem,
                itemWhatsapp: styles.itemWhatsapp,
                itemTelegram: styles.itemTelegram,
                itemEmail: styles.itemEmail,
                itemCopy: styles.itemCopy,
                iconSmall: styles.iconSmall,
              }}
            />
          </div>
        </div>

        {(!isPriceHidden || !hideAvailability) && (() => {
          const discountInfo = calculateDiscount(
            article.price,
            article.discount_type,
            article.discount_value,
            categoryDiscountPercent,
            generalDiscountPercent
          );
          const hasDiscount = discountInfo.appliedSource !== 'none';

          return (
            <div className={styles.metaRow}>
              {!isPriceHidden && (
                <div className={styles.priceContainer}>
                  {hasDiscount && (
                    <span className={discountInfo.discountType === 'amount' ? styles.discountBubbleBlue : styles.discountBubbleRed}>
                      {discountInfo.discountType === 'amount' 
                        ? `-${formatPrice(discountInfo.discountValue)}` 
                        : `-${discountInfo.discountValue}%`}
                    </span>
                  )}
                  {hasDiscount ? (
                    <>
                      <span className={styles.originalPriceStrikethrough}>{formatPrice(discountInfo.originalPrice)}</span>
                      <span className={styles.price}>{formatPrice(discountInfo.finalPrice)}</span>
                    </>
                  ) : (
                    <span className={styles.price}>{formatPrice(discountInfo.originalPrice)}</span>
                  )}
                </div>
              )}
              {!hideAvailability && (
                <span className={article.quantity <= 0 ? styles.stockOut : styles.stockIn}>
                  {article.quantity <= 0 ? 'Agotado' : 'Disponible'}
                </span>
              )}
            </div>
          );
        })()}
        <Link href={`/article/${article.id}`} className={styles.detailLink}>
          Ver ficha
        </Link>
      </div>
      {toastMsg && (
        <div className={styles.cardToast} role="alert">
          {toastMsg}
        </div>
      )}
    </article>
  );
}
