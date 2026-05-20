import styles from './article.module.css';

export default function ArticleLoading() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <div className={styles.loadingButton} />
        </div>

        <div className={styles.layout}>
          <div className={styles.loadingGallery} />

          <section className={styles.detailsCard}>
            <div className={styles.loadingHeadline} />
            <div className={styles.loadingTextLine} />
            <div className={styles.loadingTextLineShort} />

            <div className={styles.loadingSection}>
              <div className={styles.loadingInfoBlock} />
              <div className={styles.loadingInfoBlockShort} />
            </div>

            <div className={styles.loadingSection}>
              <div className={styles.loadingAction} />
              <div className={styles.loadingAction} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
