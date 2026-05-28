import { supabase } from '@/lib/supabase';
import { getFlagEmoji } from '@/lib/utils';
import { getMECLogo } from '@/lib/utils.server';
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
  discount_percent?: number | null;
};

type Article = {
  id: number;
  title: string;
  description: string | null;
  price: number | string;
  quantity: number;
  image_urls: string[] | null;
  discount_type?: string | null;
  discount_value?: number | null;
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

  // 1. Fetch category
  let category: Category | null = null;
  let categoryError = null;

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, country_code, discount_percent')
      .eq('country_code', countryCode)
      .maybeSingle<Category>();
    
    if (error) {
      if (error.message.includes('discount_percent')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('categories')
          .select('id, name, country_code')
          .eq('country_code', countryCode)
          .maybeSingle<Category>();
        category = fallbackData ? { ...fallbackData, discount_percent: null } : null;
        categoryError = fallbackError;
      } else {
        category = data;
        categoryError = error;
      }
    } else {
      category = data;
    }
  } catch (err) {
    console.error('Error fetching category:', err);
  }

  if (categoryError) {
    console.error('Could not load category:', JSON.stringify(categoryError, null, 2));
    throw new Error('No se pudo cargar la categoría.');
  }

  if (!category) {
    notFound();
  }

  // 2. Fetch articles
  let articles: Article[] = [];
  let articlesError = null;

  if (category) {
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, description, price, quantity, image_urls, discount_type, discount_value')
      .eq('category_id', category.id)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      if (error.message.includes('discount_type') || error.message.includes('discount_value')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('articles')
          .select('id, title, description, price, quantity, image_urls')
          .eq('category_id', category.id)
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true });
        articles = (fallbackData ?? []).map(a => ({ ...a, discount_type: null, discount_value: null })) as Article[];
        articlesError = fallbackError;
      } else {
        articles = (data ?? []) as Article[];
        articlesError = error;
      }
    } else {
      articles = (data ?? []) as Article[];
    }
  }

  if (articlesError) {
    console.error('Could not load articles:', JSON.stringify(articlesError, null, 2));
    throw new Error('No se pudo cargar los artículos de la categoría.');
  }

  let hidePrices = false;
  let hideAvailability = false;
  let generalDiscountPercent = '';
  try {
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('key, value');

    if (!settingsError && settingsData) {
      const settingsMap = new Map(settingsData.map((s) => [s.key, s.value]));
      hidePrices = settingsMap.get('hide_prices') === 'true';
      hideAvailability = settingsMap.get('hide_availability') === 'true';
      generalDiscountPercent = settingsMap.get('general_discount_percent') || '';
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }

  const allArticles = articles ?? [];
  const availableArticles = allArticles.filter((a) => a.quantity > 0);
  const soldOutArticles = allArticles.filter((a) => a.quantity <= 0);
  const articleItems = [...availableArticles, ...soldOutArticles];
  const mecLogo = await getMECLogo(category.country_code);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          {mecLogo && (
            <div className={styles.mecLogoWrapper}>
              <div className={styles.logoContainer}>
                <Image
                  src={mecLogo}
                  alt={`MEC ${category.name}`}
                  width={320}
                  height={200}
                  className={styles.mecLogoHeader}
                  priority
                  style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
                />
                <span className={styles.availableBadge}>
                  {availableArticles.length}
                </span>
              </div>
            </div>
          )}

          {mecLogo === '/logo_mini.png' && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <span className={styles.flag}>
                {getFlagEmoji(category.country_code)}
              </span>
            </div>
          )}

          <div className={styles.topBar}>
            <Link href="/" className={styles.backLink}>
              ← Principal
            </Link>
          </div>
        </header>

        {articleItems.length > 0 ? (
          <InfiniteArticleGrid 
            articles={articleItems} 
            hidePrices={hidePrices} 
            hideAvailability={hideAvailability} 
            categoryDiscountPercent={category?.discount_percent}
            generalDiscountPercent={generalDiscountPercent}
          />
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
