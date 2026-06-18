import { supabase } from '@/lib/supabase';
import { getFlagEmoji } from '@/lib/utils';
import { getMECLogo } from '@/lib/utils.server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import InfiniteArticleGrid from './InfiniteArticleGrid';
import styles from './category.module.css';


export const revalidate = 60;

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
  frame_image_urls?: string[] | null;
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
    alternates: {
      canonical: `/category/${country.toLowerCase()}`,
    },
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

  // 1. Fetch category and settings in parallel
  let category: Category | null = null;
  let categoryError = null;
  let settingsData = null;
  let settingsError = null;

  try {
    const categoryPromise = supabase
      .from('categories')
      .select('id, name, country_code, discount_percent')
      .eq('country_code', countryCode)
      .maybeSingle<Category>();

    const settingsPromise = supabase
      .from('settings')
      .select('key, value');

    const [categoryResult, settingsResult] = await Promise.all([
      categoryPromise,
      settingsPromise
    ]);

    // Process category
    let categoryData = categoryResult.data;
    let catErr = categoryResult.error;
    if (catErr) {
      if (catErr.message.includes('discount_percent')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('categories')
          .select('id, name, country_code')
          .eq('country_code', countryCode)
          .maybeSingle<Category>();
        category = fallbackData ? { ...fallbackData, discount_percent: null } : null;
        categoryError = fallbackError;
      } else {
        category = categoryData;
        categoryError = catErr;
      }
    } else {
      category = categoryData;
    }

    // Process settings
    settingsData = settingsResult.data;
    settingsError = settingsResult.error;
  } catch (err) {
    console.error('Error fetching initial category and settings data:', err);
  }

  if (categoryError) {
    console.error('Could not load category:', JSON.stringify(categoryError, null, 2));
    throw new Error('No se pudo cargar la categoría.');
  }

  if (!category) {
    notFound();
  }

  // 2. Fetch articles (depends on category id)
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

  // Parse settings
  let hidePrices = false;
  let hideAvailability = false;
  let generalDiscountPercent = '';
  if (!settingsError && settingsData) {
    const settingsMap = new Map(settingsData.map((s) => [s.key, s.value]));
    hidePrices = settingsMap.get('hide_prices') === 'true';
    hideAvailability = settingsMap.get('hide_availability') === 'true';
    generalDiscountPercent = settingsMap.get('general_discount_percent') || '';
  }

  const allArticles = articles ?? [];
  const availableArticles = allArticles.filter((a) => a.quantity > 0);
  const soldOutArticles = allArticles.filter((a) => a.quantity <= 0);
  const articleItems = [...availableArticles, ...soldOutArticles];
  const mecLogo = await getMECLogo(category.country_code);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
          <header className={styles.header} style={{ marginBottom: 0 }}>
            {mecLogo && (
              <div className={styles.mecLogoWrapper}>
                <div className={styles.logoContainer}>
                  <Image
                    src={mecLogo}
                    alt={`MEC ${category.name}`}
                    className={styles.mecLogoHeader}
                    width={320}
                    height={90}
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
              <Link href="/" className={`${styles.backLink} neon-card ${category.country_code ? `neon-card-${category.country_code.toUpperCase()}` : ''}`}>
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
            countryCode={category?.country_code}
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': [
              {
                '@type': 'ListItem',
                'position': 1,
                'name': 'Inicio',
                'item': 'https://www.minienginescreations.com'
              },
              {
                '@type': 'ListItem',
                'position': 2,
                'name': category.name,
                'item': `https://www.minienginescreations.com/category/${country.toLowerCase()}`
              }
            ]
          })
        }}
      />
    </main>
  );
}
