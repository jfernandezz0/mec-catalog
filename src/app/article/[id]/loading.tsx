import SkeletonLoader from '@/app/components/SkeletonLoader';
import styles from './article.module.css';

export default function ArticleLoading() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <div className={styles.loadingButton} />
        </div>

        <SkeletonLoader type="detail" />
      </div>
    </main>
  );
}
