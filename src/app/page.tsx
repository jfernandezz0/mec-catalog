import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import CategoryCard from './CategoryCard';

export const revalidate = 0;

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
  // Fetch categories with their article count, filtering hidden categories if the field exists.
  let categoryList: Category[] = [];
  let shouldFilterVisibility = false;

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, country_code, is_visible, articles(count)')
    .order('id', { ascending: true });

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

  if (shouldFilterVisibility) {
    categoryList = categoryList.filter((category) => category.is_visible !== false);
  }

  // Sort by article count descending
  const sorted = categoryList.sort((a, b) => {
    const countA = Array.isArray(a.articles) ? a.articles[0]?.count ?? 0 : 0;
    const countB = Array.isArray(b.articles) ? b.articles[0]?.count ?? 0 : 0;
    return countB - countA;
  });

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto font-sans bg-[color:var(--bg-page)] text-[color:var(--text-primary)]">
      <header className="text-center mb-10 mt-8">
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.png"
            alt="MiniEngines Creations"
            width={320}
            height={120}
            priority
            style={{ width: '100%', maxWidth: '320px', height: 'auto', filter: 'invert(var(--logo-invert, 0))' }}
          />
        </div>
        <p className="text-[color:var(--text-secondary)] text-sm">
          Catálogo digital de artículos y ediciones limitadas.
        </p>
      </header>

      <div className="flex justify-center mb-12">
        <a
          href="https://www.instagram.com/minienginescreations"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[color:var(--text-primary)] opacity-85 hover:text-pink-600 transition-all"
          aria-label="Visitar Instagram de MiniEngines Creations"
        >
          <Instagram size={28} />
        </a>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4 text-center text-[color:var(--text-primary)]">Categorías</h2>
        {/* 2 columns on mobile, 4 on md+ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sorted.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>
    </main>
  );
}
