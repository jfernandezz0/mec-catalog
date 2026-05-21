import { supabase } from '@/lib/supabase';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleGallery from './ArticleGallery';
import ShareButtons from './ShareButtons';
import styles from './article.module.css';

export const revalidate = 0;

type Article = {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  price: number | string;
  quantity: number;
  image_urls: string[] | null;
};

type Category = {
  name: string;
  country_code: string;
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

  const { data: article, error: articleError } = await supabase
    .from('articles')
    .select('id, category_id, title, description, price, quantity, image_urls')
    .eq('id', articleId)
    .maybeSingle<Article>();

  if (articleError) {
    console.error('Could not load article:', JSON.stringify(articleError, null, 2));
    throw new Error('No se pudo cargar el artículo.');
  }

  if (!article) {
    notFound();
  }

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('name, country_code')
    .eq('id', article.category_id)
    .maybeSingle<Category>();

  if (categoryError) {
    console.error('Could not load category:', JSON.stringify(categoryError, null, 2));
    throw new Error('No se pudo cargar la categoría asociada al artículo.');
  }

  let paymentsEnabled = false;
  try {
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'payments_enabled')
      .maybeSingle();

    if (!settingsError && settingsData) {
      paymentsEnabled = settingsData.value === 'true';
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }

  const noteText = `MEC | mini engines - ID ${article.id}`;
  const amountInCents = Math.round(Number(article.price) * 100);
  const revolutPayUrl = `https://revolut.me/jfernandezz?currency=EUR&amount=${amountInCents}&note=${encodeURIComponent(noteText)}`;

  const categoryHref = category
    ? `/category/${category.country_code.toLowerCase()}`
    : '/';

  const imageUrls = article.image_urls?.filter(Boolean) ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <Link href={categoryHref} className={styles.backLink}>
            ← Volver a {category?.name ?? 'categorías'}
          </Link>
        </div>

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

            <div className={styles.facts}>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Precio</span>
                <span className={styles.factValue}>
                  {formatPrice(article.price)}
                </span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Estado</span>
                <span className={article.quantity === 0 ? styles.stockOut : styles.stockIn}>
                  {article.quantity === 0 ? 'Agotado' : 'Disponible'}
                </span>
              </div>
            </div>

            {paymentsEnabled && article.quantity > 0 && (
              <div className={styles.paymentAction}>
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
                  <span className="align-middle">Comprar ahora (Revolut)</span>
                </a>
              </div>
            )}

            <ShareButtons id={article.id} title={article.title} />

            <p className={styles.disclaimer}>
              *Todos nuestros diseños de MOCs (montajes de bloques) son de creaccion propia e intentan reflejar de la mejor manera un vehiculo realista, la imagen del vehiculo y los datos reales son meramente informativas, y han sido extraidas de diferentes fuentes oficiales
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
