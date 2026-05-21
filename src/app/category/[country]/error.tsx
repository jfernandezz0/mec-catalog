'use client';

import Link from 'next/link';
import styles from './category.module.css';

type CategoryErrorProps = {
  error: Error;
  reset: () => void;
};

export default function CategoryError({ error, reset }: CategoryErrorProps) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.backLink}>
            ← Principal
          </Link>
        </div>

        <section className={styles.empty}>
          <h2 className={styles.emptyTitle}>Error al cargar la categoría</h2>
          <p className={styles.emptyText}>
            {error.message || 'Ha ocurrido un problema al cargar la información. Intenta recargar la página.'}
          </p>
          <div className={styles.errorActions}>
            <button type="button" onClick={() => reset()} className={styles.retryButton}>
              Reintentar
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
