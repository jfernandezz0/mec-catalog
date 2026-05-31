import { supabase } from '@/lib/supabase';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleGallery from './ArticleGallery';
import ShareButtons from './ShareButtons';
import styles from './article.module.css';
import { getMECLogo } from '@/lib/utils.server';


export const revalidate = 0;

import { calculateDiscount } from '@/lib/discounts';

type Article = {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  price: number | string;
  quantity: number;
  image_urls: string[] | null;
  discount_type?: string | null;
  discount_value?: number | null;
};

type Category = {
  name: string;
  country_code: string;
  discount_percent?: number | null;
};

function formatPrice(value: number | string) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value));
}

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

  let article: Article | null = null;
  let articleError = null;

  try {
    const { data, error } = await supabase
      .from('articles')
      .select('id, category_id, title, description, price, quantity, image_urls, discount_type, discount_value')
      .eq('id', articleId)
      .maybeSingle<Article>();
    if (error) {
      if (error.message.includes('discount_type') || error.message.includes('discount_value')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('articles')
          .select('id, category_id, title, description, price, quantity, image_urls')
          .eq('id', articleId)
          .maybeSingle<Article>();
        article = fallbackData ? { ...fallbackData, discount_type: null, discount_value: null } : null;
        articleError = fallbackError;
      } else {
        article = data;
        articleError = error;
      }
    } else {
      article = data;
    }
  } catch (err) {
    console.error('Error loading article:', err);
  }

  if (articleError) {
    console.error('Could not load article:', JSON.stringify(articleError, null, 2));
    throw new Error('No se pudo cargar el artículo.');
  }

  if (!article) {
    notFound();
  }

  let category: Category | null = null;
  let categoryError = null;

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('name, country_code, discount_percent')
      .eq('id', article.category_id)
      .maybeSingle<Category>();
    if (error) {
      if (error.message.includes('discount_percent')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('categories')
          .select('name, country_code')
          .eq('id', article.category_id)
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
    console.error('Error loading category:', err);
  }

  if (categoryError) {
    console.error('Could not load category:', JSON.stringify(categoryError, null, 2));
    throw new Error('No se pudo cargar la categoría asociada al artículo.');
  }

  let paymentsEnabled = false;
  let revolutEnabled = true;
  let paypalEnabled = true;
  let hidePrices = false;
  let hideAvailability = false;
  let generalDiscountPercent = '';
  try {
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('key, value');

    if (!settingsError && settingsData) {
      const settingsMap = new Map(settingsData.map((s) => [s.key, s.value]));
      paymentsEnabled = settingsMap.get('payments_enabled') === 'true';
      revolutEnabled = settingsMap.get('revolut_enabled') !== 'false';
      paypalEnabled = settingsMap.get('paypal_enabled') !== 'false';
      hidePrices = settingsMap.get('hide_prices') === 'true';
      hideAvailability = settingsMap.get('hide_availability') === 'true';
      generalDiscountPercent = settingsMap.get('general_discount_percent') || '';
    }
  } catch (e) {
    console.error('Error loading settings:', e);
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

  const noteText = `MEC | mini engines - ID ${article.id}`;
  const amountInCents = Math.round(Number(finalPrice) * 100);
  const revolutPayUrl = `https://revolut.me/jfernandezz?currency=EUR&amount=${amountInCents}&note=${encodeURIComponent(noteText)}`;

  // PayPal Classic Checkout URL (with dynamic item_name and amount)
  const paypalPrice = Number(finalPrice).toFixed(2);
  const paypalPayUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=javifzlvdc@gmail.com&item_name=${encodeURIComponent(noteText)}&amount=${paypalPrice}&currency_code=EUR&no_shipping=1`;

  const categoryHref = category
    ? `/category/${category.country_code.toLowerCase()}`
    : '/';

  const mecLogo = category ? await getMECLogo(category.country_code) : null;

  const imageUrls = article.image_urls?.filter(Boolean) ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
          <header className={styles.articlePageHeader}>
            {mecLogo && (
              <div className={styles.articleLogoWrapper}>
                <div className={styles.articleLogoContainer}>
                  <img
                    src={mecLogo}
                    alt={category?.name || 'MiniEngines Creations'}
                    className={styles.articleLogoImage}
                    style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}
            <div className={styles.topBar} style={{ marginTop: '16px', marginBottom: 0 }}>
              <Link href={categoryHref} className={styles.backLink}>
                ← Volver
              </Link>
            </div>
          </header>

        <div className={styles.layout}>
          <ArticleGallery id={article.id} imageUrls={imageUrls} title={article.title} />

          <section className={styles.detailsCard}>
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
                {paymentsEnabled && (revolutEnabled || paypalEnabled) && (
                  <div className={styles.paymentButtons}>
                    {revolutEnabled && (
                      <a
                        href={revolutPayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.buyButton}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-2 inline-block align-middle"
                        >
                          <rect width="20" height="14" x="2" y="5" rx="2" />
                          <line x1="2" x2="22" y1="10" y2="10" />
                        </svg>
                        <span className="align-middle">Pagar ahora</span>
                      </a>
                    )}
                    {paypalEnabled && (
                      <a
                        href={paypalPayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.paypalButton}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="mr-2 inline-block align-middle"
                        >
                          <path d="M14.06 3.713c.12-1.071-.093-1.832-.702-2.526C12.628.356 11.312 0 9.626 0H4.734a.7.7 0 0 0-.691.59L2.005 13.509a.42.42 0 0 0 .415.486h2.756l-.202 1.28a.628.628 0 0 0 .62.726H8.14c.429 0 .793-.31.862-.731l.025-.13.48-3.043.03-.164.001-.007a.35.35 0 0 1 .348-.297h.38c1.266 0 2.425-.256 3.345-.91q.57-.403.993-1.005a4.94 4.94 0 0 0 .88-2.195c.242-1.246.13-2.356-.57-3.154a2.7 2.7 0 0 0-.76-.59l-.094-.061ZM6.543 8.82a.7.7 0 0 1 .321-.079H8.3c2.82 0 5.027-1.144 5.672-4.456l.003-.016q.326.186.548.438c.546.623.679 1.535.45 2.71-.272 1.397-.866 2.307-1.663 2.874-.802.57-1.842.815-3.043.815h-.38a.87.87 0 0 0-.863.734l-.03.164-.48 3.043-.024.13-.001.004a.35.35 0 0 1-.348.296H5.595a.106.106 0 0 1-.105-.123l.208-1.32z"/>
                        </svg>
                        <span className="align-middle">Pagar con PayPal</span>
                      </a>
                    )}
                  </div>
                )}

                {paymentsEnabled && (revolutEnabled || paypalEnabled) && (
                  <div style={{ marginTop: '18px' }}>
                    <p className={styles.paymentNote}>
                      🚨 Recuerda comunicarte con el equipo de ingeniería enviándoles una captura del pago sin modificar. Les facilitarás el trabajo ⚙️📦🧡
                    </p>
                    <p className={styles.paymentNote} style={{ marginTop: '12px' }}>
                      🔔 Consulta disponibilidad del MOC de bloques antes del pago, la web podría contener errores, por eso se confirmará el pedido lo antes posible 🏎️💨
                    </p>
                    <p className={styles.paymentNote} style={{ marginTop: '12px' }}>
                      🔰 Todos los artículos deben recogerse por su fragilidad. Si necesitas envío (no incluido), consúltanos antes en nuestros canales y encontraremos una solución 🦾
                    </p>
                  </div>
                )}
              </div>
            )}

            <ShareButtons id={article.id} title={article.title} />

            <p className={styles.disclaimer}>
              Nuestros diseños MOCs (de bloques) son de creación propia e intentan reflejar de la mejor manera un vehículo real; la imagen y los datos del vehículo son meramente informativos y han sido extraídos de diferentes fuentes oficiales.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
