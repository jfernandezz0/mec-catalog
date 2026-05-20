'use client';

import Link from 'next/link';
import styles from './article.module.css';

type ArticleErrorProps = {
  error: Error;
  reset: () => void;
};

export default function ArticleError({ error, reset }: ArticleErrorProps) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.backLink}>
            ← Volver a categorías
          </Link>
        </div>

        <section className={styles.empty}>
          <h2 className={styles.emptyTitle}>Error al cargar el artículo</h2>
          <p className={styles.emptyText}>
            {error.message || 'Ha ocurrido un problema al cargar el artículo. Intenta recargar la página.'}
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
