import SkeletonLoader from '@/app/components/SkeletonLoader';
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

        <SkeletonLoader type="grid" count={6} />
      </div>
    </main>
  );
}
