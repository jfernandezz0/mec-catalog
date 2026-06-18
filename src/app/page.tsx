import { supabase } from '@/lib/supabase';
import CategoryCard from './CategoryCard';
import Image from 'next/image';
import SearchBar from './components/SearchBar';

import GlobeWrapper from './components/GlobeWrapper';

export const revalidate = 60;

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

type Category = {
  id: number;
  name: string;
  country_code: string;
  is_visible?: boolean;
  articles?: Array<{ count: number }>;
};

function Instagram({ size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

export default async function Home() {
  // Fetch categories with their article count and settings in parallel
  let categoryList: Category[] = [];
  let shouldFilterVisibility = false;
  let settingsData = null;
  let settingsError = null;

  try {
    const categoriesPromise = supabase
      .from('categories')
      .select('id, name, country_code, is_visible, articles(count)')
      .order('id', { ascending: true });

    const settingsPromise = supabase
      .from('settings')
      .select('key, value');

    const [categoriesResult, settingsResult] = await Promise.all([
      categoriesPromise,
      settingsPromise
    ]);

    let categories = categoriesResult.data;
    let error = categoriesResult.error;

    if (error) {
      if (error.message.includes('is_visible')) {
        const { data: fallbackCategories, error: fallbackError } = await supabase
          .from('categories')
          .select('id, name, country_code, articles(count)')
          .order('id', { ascending: true });

        if (fallbackError) {
          console.error('Fallback error al cargar categorías:', JSON.stringify(fallbackError, null, 2));
        }

        categoryList = fallbackCategories ?? [];
      } else {
        console.error('Detalle del error de red:', JSON.stringify(error, null, 2));
        categoryList = categories ?? [];
      }
    } else {
      categoryList = categories ?? [];
      shouldFilterVisibility = true;
    }

    settingsData = settingsResult.data;
    settingsError = settingsResult.error;
  } catch (err) {
    console.error('Error loading home data:', err);
  }

  if (shouldFilterVisibility) {
    categoryList = categoryList.filter((category) => category.is_visible !== false);
  }

  // Sort by article count descending
  const sorted = categoryList.sort((a, b) => {
    const countA = Array.isArray(a.articles) ? a.articles[0]?.count ?? 0 : 0;
    const countB = Array.isArray(b.articles) ? b.articles[0]?.count ?? 0 : 0;
    return countB - countA;
  });

  // Parse settings
  let hidePrices = false;
  let generalDiscountPercent = '';
  if (!settingsError && settingsData) {
    const settingsMap = new Map(settingsData.map((s) => [s.key, s.value]));
    hidePrices = settingsMap.get('hide_prices') === 'true';
    generalDiscountPercent = settingsMap.get('general_discount_percent') || '';
  }

  return (
    <main className="min-h-screen font-sans bg-[color:var(--bg-page)] text-[color:var(--text-primary)] pb-12">
      <header className="w-full max-w-2xl mx-auto px-6 pt-6 pb-4 text-center">
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="MiniEngines Creations"
            width={320}
            height={90}
            priority
            style={{ width: '100%', maxWidth: '320px', height: 'auto', filter: 'invert(var(--logo-invert, 0))' }}
          />
        </div>
        <p className="text-[color:var(--text-secondary)] text-sm mt-4">
          Garaje digital de vehículos by MiniEngines.
          <br />
          Todos nuestros MOCs de bloques y diseños estan hechos a mano por ingenieros cualificados
        </p>
      </header>

      <div className="w-full overflow-hidden">
        <GlobeWrapper categories={sorted} />
      </div>

      <div className="max-w-2xl mx-auto px-6">
        <SearchBar hidePrices={hidePrices} generalDiscountPercent={generalDiscountPercent} />

        <section>
          <h2 className="text-lg font-semibold mb-4 text-center text-[color:var(--text-primary)]">Listado de creaciones por origen</h2>
          {/* 2 columns on mobile, 4 on md+ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {sorted.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </section>

        <hr className="border-[color:var(--border-card)] my-8" />

        <div className="flex flex-col items-center justify-center mb-8 gap-3">
          <span className="text-lg font-semibold text-center text-[color:var(--text-primary)]">
            Síguenos en:
          </span>
          <a
            href="https://www.instagram.com/minienginescreations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[color:var(--text-primary)] opacity-85 hover:text-pink-600 transition-all"
            aria-label="Visitar Instagram de MiniEngines Creations"
          >
            <Instagram size={56} />
          </a>
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            'name': 'MiniEngines Creations',
            'url': 'https://www.minienginescreations.com',
            'logo': 'https://www.minienginescreations.com/logo.png',
            'sameAs': [
              'https://www.instagram.com/minienginescreations'
            ]
          })
        }}
      />
    </main>
  );
}
