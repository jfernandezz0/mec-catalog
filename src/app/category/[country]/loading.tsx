import styles from './category.module.css';

export default function CategoryLoading() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <div className={styles.loadingBadge} />
        </div>

        <header className={styles.header}>
          <div className={styles.loadingSectionHeading} />
          <div className={styles.loadingTextLine} />
          <div className={styles.loadingTextLineShort} />
        </header>

        <section className={styles.grid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <article key={index} className={styles.loadingCard}>
              <div className={styles.loadingCardImage} />
              <div className={styles.loadingCardLine} />
              <div className={styles.loadingCardLineShort} />
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
