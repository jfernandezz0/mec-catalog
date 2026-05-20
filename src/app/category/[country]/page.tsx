import { supabase } from '@/lib/supabase';
import { getFlagEmoji, getMECLogo } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleCard from './ArticleCard';
import styles from './category.module.css';

export const revalidate = 0;

type Category = {
  id: number;
  name: string;
  country_code: string;
};

type Article = {
  id: number;
  title: string;
  description: string | null;
  price: number | string;
  quantity: number;
  image_urls: string[] | null;
};

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  const countryCode = country.toUpperCase();

  const { data: category } = await supabase
    .from('categories')
    .select('id, name, country_code')
    .eq('country_code', countryCode)
    .maybeSingle<Category>();

  if (!category) {
    notFound();
  }

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, description, price, quantity, image_urls')
    .eq('category_id', category.id)
    .order('id', { ascending: false })
    .returns<Article[]>();

  if (error) {
    console.error('Could not load articles:', JSON.stringify(error, null, 2));
  }

  const articleItems = articles ?? [];
  const mecLogo = getMECLogo(category.country_code);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.backLink}>
            ← Volver a categorías
          </Link>
        </div>

        <header className={styles.header}>
          {mecLogo ? (
            <div className={styles.mecLogoWrapper}>
              <Image
                src={mecLogo}
                alt={`MEC ${category.name}`}
                width={320}
                height={200}
                className={styles.mecLogoHeader}
                priority
                style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div className={styles.titleRow}>
              <span className={styles.flag}>
                {getFlagEmoji(category.country_code)}
              </span>
              <h1 className={styles.title}>{category.name}</h1>
            </div>
          )}
          <p className={styles.summary}>
            {articleItems.length} artículo{articleItems.length === 1 ? '' : 's'} disponible{articleItems.length === 1 ? '' : 's'}.
          </p>
        </header>

        {articleItems.length > 0 ? (
          <section className={styles.grid}>
            {articleItems.map((article) => (
              <ArticleCard article={article} key={article.id} />
            ))}
          </section>
        ) : (
          <section className={styles.empty}>
            <h2 className={styles.emptyTitle}>Sin artículos aún</h2>
            <p className={styles.emptyText}>
              Añade el primer artículo desde el panel de administración y aparecerá aquí.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
