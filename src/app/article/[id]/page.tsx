import { supabase } from '@/lib/supabase';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import ArticleGallery from './ArticleGallery';
import ShareButtons from './ShareButtons';
import AddToCartButton from './AddToCartButton';
import styles from './article.module.css';
import { getMECLogo } from '@/lib/utils.server';
import { formatPrice } from '@/lib/utils';
import { Category, Article } from '@/lib/types';


export const revalidate = 60;

import { calculateDiscount } from '@/lib/discounts';





export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const articleId = Number(id);

  const { data: article } = await supabase
    .from('articles')
    .select('title, description, price, image_urls')
    .eq('id', articleId)
    .single();

  if (!article) return { title: 'Artículo | MiniEngines Creations' };

  const ogImage = article.image_urls?.[0] ?? 'https://mec-catalog.vercel.app/logo.png';
  const price = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(article.price));
  const description = article.description
    ? `${article.description} — ${price}`
    : `${price} · MiniEngines Creations`;

  return {
    title: `${article.title} | MiniEngines Creations`,
    description,
    alternates: {
      canonical: `/article/${id}`,
    },
    openGraph: {
      title: article.title,
      description,
      url: `https://mec-catalog.vercel.app/article/${id}`,
      siteName: 'MiniEngines Creations',
      type: 'website',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      images: [ogImage],
    },
  };
}


export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const articleId = Number(id);

  if (!Number.isInteger(articleId)) {
    notFound();
  }

  // 1. Fetch article and settings in parallel
  let article: Article | null = null;
  let articleError = null;
  let settingsData = null;
  let settingsError = null;

  try {
    const articlePromise = supabase
      .from('articles')
      .select('id, category_id, title, description, price, quantity, image_urls, frame_image_urls, discount_type, discount_value')
      .eq('id', articleId)
      .maybeSingle<Article>();

    const settingsPromise = supabase
      .from('settings')
      .select('key, value');

    const [articleResult, settingsResult] = await Promise.all([
      articlePromise,
      settingsPromise
    ]);

    // Process article
    const articleData = articleResult.data;
    const artErr = articleResult.error;
    if (artErr) {
      if (artErr.message.includes('discount_type') || artErr.message.includes('discount_value')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('articles')
          .select('id, category_id, title, description, price, quantity, image_urls, frame_image_urls')
          .eq('id', articleId)
          .maybeSingle<Article>();
        article = fallbackData ? { ...fallbackData, discount_type: null, discount_value: null } : null;
        articleError = fallbackError;
      } else {
        article = articleData;
        articleError = artErr;
      }
    } else {
      article = articleData;
    }

    // Process settings
    settingsData = settingsResult.data;
    settingsError = settingsResult.error;
  } catch (err) {
    console.error('Error loading initial article and settings data:', err);
  }

  if (articleError) {
    console.error('Could not load article:', JSON.stringify(articleError, null, 2));
    throw new Error('No se pudo cargar el artículo.');
  }

  if (!article) {
    notFound();
  }

  // 2. Fetch category and related articles in parallel (depends on article's category_id)
  let category: Category | null = null;
  let categoryError = null;
  let relatedArticles: Article[] = [];
  let relatedArticlesError = null;

  try {
    const categoryPromise = supabase
      .from('categories')
      .select('name, country_code, discount_percent')
      .eq('id', article.category_id)
      .maybeSingle<Category>();

    const relatedPromise = supabase
      .from('articles')
      .select('id, category_id, title, description, price, quantity, image_urls, discount_type, discount_value')
      .eq('category_id', article.category_id)
      .neq('id', article.id)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
      .limit(4);

    const [categoryResult, relatedResult] = await Promise.all([
      categoryPromise,
      relatedPromise
    ]);

    // Process category
    const categoryData = categoryResult.data;
    const catErr = categoryResult.error;
    if (catErr) {
      if (catErr.message.includes('discount_percent')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('categories')
          .select('name, country_code')
          .eq('id', article.category_id)
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

    // Process related articles
    const relatedData = relatedResult.data;
    const relErr = relatedResult.error;
    if (relErr) {
      if (relErr.message.includes('discount_type') || relErr.message.includes('discount_value')) {
        const { data: fallbackRelated, error: fallbackRelatedError } = await supabase
          .from('articles')
          .select('id, category_id, title, description, price, quantity, image_urls')
          .eq('category_id', article.category_id)
          .neq('id', article.id)
          .order('id', { ascending: true })
          .limit(4);
        relatedArticles = (fallbackRelated ?? []).map(a => ({ ...a, discount_type: null, discount_value: null })) as Article[];
        relatedArticlesError = fallbackRelatedError;
      } else {
        relatedArticles = (relatedData ?? []) as Article[];
        relatedArticlesError = relErr;
      }
    } else {
      relatedArticles = (relatedData ?? []) as Article[];
    }
  } catch (err) {
    console.error('Error loading category and related articles:', err);
  }

  if (categoryError) {
    console.error('Could not load category:', JSON.stringify(categoryError, null, 2));
    throw new Error('No se pudo cargar la categoría asociada al artículo.');
  }

  if (relatedArticlesError) {
    console.error('Could not load related articles:', JSON.stringify(relatedArticlesError, null, 2));
  }

  // Parse settings
  let paymentsEnabled = false;
  let squareEnabled = false;
  let hidePrices = false;
  let hideAvailability = false;
  let generalDiscountPercent = '';
  if (!settingsError && settingsData) {
    const settingsMap = new Map(settingsData.map((s) => [s.key, s.value]));
    paymentsEnabled = settingsMap.get('payments_enabled') === 'true';
    squareEnabled = settingsMap.get('square_payments_enabled') === 'true';
    hidePrices = settingsMap.get('hide_prices') === 'true';
    hideAvailability = settingsMap.get('hide_availability') === 'true';
    generalDiscountPercent = settingsMap.get('general_discount_percent') || '';
  }

  const isPriceHidden = hidePrices || article.quantity <= 0;

  const discountInfo = calculateDiscount(
    article.price,
    article.discount_type,
    article.discount_value,
    category?.discount_percent,
    generalDiscountPercent
  );
  const hasDiscount = discountInfo.appliedSource !== 'none';
  const finalPrice = discountInfo.finalPrice;

  const categoryHref = category
    ? `/category/${category.country_code.toLowerCase()}`
    : '/';

  const mecLogo = category ? await getMECLogo(category.country_code) : null;

  const countryUpper = category?.country_code?.toUpperCase() ?? '';

  const imageUrls = article.image_urls?.filter(Boolean) ?? [];
  const frameImageUrls = article.frame_image_urls?.filter(Boolean) ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
          <header className={styles.articlePageHeader}>
            {mecLogo && (
              <div className={styles.articleLogoWrapper}>
                <div className={styles.articleLogoContainer}>
                  <Image
                    src={mecLogo}
                    alt={category?.name || 'MiniEngines Creations'}
                    className={styles.articleLogoImage}
                    width={320}
                    height={90}
                    priority
                    style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}
            <div className={styles.topBar} style={{ marginTop: '16px', marginBottom: 0 }}>
              <Link href={categoryHref} className={`${styles.backLink} neon-card ${countryUpper ? `neon-card-${countryUpper}` : ''}`}>
                ← Volver
              </Link>
            </div>
          </header>

        <div className={styles.layout}>
          <ArticleGallery id={article.id} imageUrls={imageUrls} frameImageUrls={frameImageUrls} title={article.title} countryCode={category?.country_code} />

          <section className={`${styles.detailsCard} neon-card ${countryUpper ? `neon-card-${countryUpper}` : ''}`}>
            <span className={styles.refCode}>
              #MEC-{String(article.id).padStart(4, '0')}
            </span>
            <p className={styles.eyebrow}>
              {category?.name ?? 'MiniEngines Creations'}
            </p>
            {(() => {
              const parts = article.title.split(' – ');
              const marca = parts[0];
              const modelo = parts.slice(1).join(' – ');
              return modelo ? (
                <>
                  <p className={styles.marca}>{marca}</p>
                  <h1 className={styles.title}>{modelo}</h1>
                </>
              ) : (
                <h1 className={styles.title}>{article.title}</h1>
              );
            })()}
            <p className={styles.description}>
              {article.description || 'Sin descripción disponible.'}
            </p>

            {(!isPriceHidden || !hideAvailability) && (
              <div className={styles.facts}>
                {!isPriceHidden && (
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>Precio</span>
                    <span className={styles.factValue}>
                      <span className={styles.priceContainer}>
                        {hasDiscount && (
                          <span className={discountInfo.discountType === 'amount' ? styles.discountBubbleBlue : styles.discountBubbleRed}>
                            {discountInfo.discountType === 'amount' 
                              ? `-${formatPrice(discountInfo.discountValue)}` 
                              : `-${discountInfo.discountValue}%`}
                          </span>
                        )}
                        {hasDiscount ? (
                          <>
                            <span className={styles.originalPriceStrikethrough}>{formatPrice(discountInfo.originalPrice)}</span>
                            <span>{formatPrice(discountInfo.finalPrice)}</span>
                          </>
                        ) : (
                          <span>{formatPrice(discountInfo.originalPrice)}</span>
                        )}
                      </span>
                    </span>
                  </div>
                )}
                {!hideAvailability && (
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>Estado</span>
                    <span className={article.quantity <= 0 ? styles.stockOut : styles.stockIn}>
                      {article.quantity <= 0 ? 'Agotado' : 'Disponible'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {article.quantity > 0 && !isPriceHidden && (
              <div className={styles.paymentAction}>
                {/* Add to cart + Square quick-pay */}
                <AddToCartButton
                  article={article}
                  finalPrice={finalPrice}
                  squareEnabled={squareEnabled && paymentsEnabled}
                  squareCheckoutUrl={`/checkout?article=${article.id}`}
                />
              </div>
            )}

            <ShareButtons id={article.id} title={article.title} />

            <p className={styles.disclaimer}>
              Nuestros diseños MOCs (de bloques) son de creación propia e intentan reflejar de la mejor manera un vehículo real; la imagen y los datos del vehículo son meramente informativos y han sido extraídos de diferentes fuentes oficiales.
              <br />
              <br />
              Se presentan en un marco expositor, con una tira led USB de (blanco neutro) que recorre todo el perímetro interior, y tiene una medida exterior de 27x27x6*cm (Alto/Ancho/fondo)
              <br />
              * Las medidas tienen un margen de error de (+-1cm) y dependen del contenido.
            </p>
          </section>
        </div>

        {relatedArticles.length > 0 && (
          <section className={styles.relatedSection}>
            <h2 className={styles.relatedHeading}>También te puede interesar</h2>
            <div className={styles.relatedGrid}>
              {relatedArticles.map((rel) => {
                const parts = rel.title.split(' – ');
                const marca = parts[0];
                const modelo = parts.slice(1).join(' – ');
                
                const relDiscountInfo = calculateDiscount(
                  rel.price,
                  rel.discount_type,
                  rel.discount_value,
                  category?.discount_percent,
                  generalDiscountPercent
                );
                
                return (
                  <Link
                    href={`/article/${rel.id}`}
                    key={rel.id}
                    className={`${styles.relatedCard} neon-card ${countryUpper ? `neon-card-${countryUpper}` : ''}`}
                  >
                    <div className={styles.relatedImageWrap}>
                      {rel.image_urls?.[0] ? (
                        <Image
                          src={rel.image_urls[0]}
                          alt={rel.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 25vw"
                          className={styles.relatedImage}
                        />
                      ) : (
                        <div className={styles.relatedNoImage}>🚗</div>
                      )}
                    </div>
                    
                    <div className={styles.relatedContent}>
                      <span className={styles.relatedMarca}>{marca}</span>
                      <h3 className={styles.relatedTitle}>{modelo || rel.title}</h3>
                      <div className={styles.relatedMeta}>
                        {!hidePrices && (
                          <span className={styles.relatedPrice}>
                            {formatPrice(relDiscountInfo.finalPrice)}
                          </span>
                        )}
                        {!hideAvailability && (
                          <span className={rel.quantity > 0 ? styles.stockInSmall : styles.stockOutSmall}>
                            {rel.quantity > 0 ? 'Disponible' : 'Agotado'}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            'name': article.title,
            'image': article.image_urls?.filter(Boolean) ?? [],
            'description': article.description || `Miniatura de coche de bloques ${article.title}`,
            'offers': {
              '@type': 'Offer',
              'url': `https://www.minienginescreations.com/article/${article.id}`,
              'priceCurrency': 'EUR',
              'price': article.price,
              'availability': article.quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              'itemCondition': 'https://schema.org/NewCondition'
            }
          })
        }}
      />
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
                'name': category?.name || 'Categoría',
                'item': category ? `https://www.minienginescreations.com/category/${category.country_code.toLowerCase()}` : 'https://www.minienginescreations.com'
              },
              {
                '@type': 'ListItem',
                'position': 3,
                'name': article.title,
                'item': `https://www.minienginescreations.com/article/${article.id}`
              }
            ]
          })
        }}
      />
    </main>
  );
}
