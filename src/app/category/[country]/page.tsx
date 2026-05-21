import { supabase } from '@/lib/supabase';
import { getFlagEmoji, getMECLogo } from '@/lib/utils';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import InfiniteArticleGrid from './InfiniteArticleGrid';
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

export async function generateMetadata(
  { params }: { params: Promise<{ country: string }> }
): Promise<Metadata> {
  const { country } = await params;

  const { data: category } = await supabase
    .from('categories')
    .select('id, name, country_code')
    .eq('country_code', country.toUpperCase())
    .single();

  if (!category) return { title: 'Categoría | MiniEngines Creations' };

  const flag = getFlagEmoji(category.country_code);
  const title = `${flag} ${category.name} | MiniEngines Creations`;
  const description = `Explora el catálogo de artículos de ${category.name} en MiniEngines Creations.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://mec-catalog.vercel.app/category/${country}`,
      siteName: 'MiniEngines Creations',
      type: 'website',
      images: [
        {
          url: 'https://mec-catalog.vercel.app/logo.png',
          width: 800,
          height: 300,
          alt: `MiniEngines Creations — ${category.name}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}


export default async function CategoryPage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  const countryCode = country.toUpperCase();

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id, name, country_code')
    .eq('country_code', countryCode)
    .maybeSingle<Category>();

  if (categoryError) {
    console.error('Could not load category:', JSON.stringify(categoryError, null, 2));
    throw new Error('No se pudo cargar la categoría.');
  }

  if (!category) {
    notFound();
  }

  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('id, title, description, price, quantity, image_urls')
    .eq('category_id', category.id)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
    .returns<Article[]>();

  if (articlesError) {
    console.error('Could not load articles:', JSON.stringify(articlesError, null, 2));
    throw new Error('No se pudo cargar los artículos de la categoría.');
  }

  const allArticles = articles ?? [];
  const availableArticles = allArticles.filter((a) => a.quantity > 0);
  const soldOutArticles = allArticles.filter((a) => a.quantity === 0);
  const articleItems = [...availableArticles, ...soldOutArticles];
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
            {availableArticles.length} artículo{availableArticles.length === 1 ? '' : 's'} disponible{availableArticles.length === 1 ? '' : 's'}
            {soldOutArticles.length > 0 && ` · ${soldOutArticles.length} agotado${soldOutArticles.length === 1 ? '' : 's'}`}.
          </p>
        </header>

        {articleItems.length > 0 ? (
          <InfiniteArticleGrid articles={articleItems} />
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
