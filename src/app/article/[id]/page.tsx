import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleGallery from './ArticleGallery';
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

function getWhatsAppHref(title: string) {
  const phoneNumber = '34619148601';
  const rawMessage = `Hola, estoy interesado en el artículo ${title}, ¿podrías darme mas información?`;
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(rawMessage)}`;
}

function getEmailHref(title: string) {
  const email = 'minienginescreations@gmail.com';
  const subject = encodeURIComponent(title);
  const body = encodeURIComponent(`Hola, estoy interesado en el artículo ${title}. ¿Podrías darme más información? Un saludo.`);
  return `mailto:${email}?subject=${subject}&body=${body}`;
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

  const { data: article } = await supabase
    .from('articles')
    .select('id, category_id, title, description, price, quantity, image_urls')
    .eq('id', articleId)
    .maybeSingle<Article>();

  if (!article) {
    notFound();
  }

  const { data: category } = await supabase
    .from('categories')
    .select('name, country_code')
    .eq('id', article.category_id)
    .maybeSingle<Category>();

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
          <ArticleGallery imageUrls={imageUrls} title={article.title} />

          <section className={styles.detailsCard}>
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

            <p className={styles.contactPrompt}>
              Consulta disponibilidad y costes de envío aquí:
            </p>
            <div className={styles.actions}>
              <a
                href={getWhatsAppHref(article.title)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.whatsappAction}
              >
                WhatsApp
              </a>
              <a
                href="https://www.instagram.com/minienginescreations?igsh=MWRkMXpwYXJma2ZmYw%3D%3D&utm_source=qr"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.instagramAction}
              >
                Instagram
              </a>
              <a
                href={getEmailHref(article.title)}
                className={styles.emailAction}
              >
                Email
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
