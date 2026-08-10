'use client';

import React from 'react';
import styles from './SkeletonLoader.module.css';

interface SkeletonLoaderProps {
  type?: 'grid' | 'detail';
  count?: number;
}

export default function SkeletonLoader({ type = 'grid', count = 6 }: SkeletonLoaderProps) {
  if (type === 'detail') {
    return (
      <div className={styles.container}>
        <div className={styles.detailLayout}>
          {/* Gallery placeholder */}
          <div className={`${styles.gallery} ${styles.pulse}`} />

          {/* Details metadata placeholder */}
          <div className={styles.detailInfo}>
            <div className={`${styles.detailRef} ${styles.pulse}`} />
            <div className={`${styles.detailTitle} ${styles.pulse}`} />
            <div className={`${styles.detailDescLine} ${styles.pulse}`} />
            <div className={`${styles.detailDescLineShort} ${styles.pulse}`} />
            <div className={`${styles.detailDescLine} ${styles.pulse}`} style={{ width: '90%' }} />
            <div className={`${styles.detailPrice} ${styles.pulse}`} />
            <div className={`${styles.detailButton} ${styles.pulse}`} />
            <div className={`${styles.detailButton} ${styles.pulse}`} style={{ marginTop: '12px' }} />
          </div>
        </div>
      </div>
    );
  }

  // Otherwise render a Grid loading skeleton
  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className={styles.card}>
            <div className={`${styles.cardImage} ${styles.pulse}`} />
            <div className={`${styles.cardTitle} ${styles.pulse}`} />
            <div className={`${styles.cardMeta} ${styles.pulse}`} />
            <div className={`${styles.cardPrice} ${styles.pulse}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
