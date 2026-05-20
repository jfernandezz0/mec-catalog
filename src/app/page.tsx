import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import CategoryCard from './CategoryCard';

export const revalidate = 0;

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
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
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error("Detalle del error de red:", JSON.stringify(error, null, 2));
  }

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto font-sans bg-neutral-50">
      <header className="text-center mb-10 mt-8">
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.png"
            alt="MiniEngines Creations"
            width={320}
            height={120}
            priority
            style={{ width: '100%', maxWidth: '320px', height: 'auto' }}
          />
        </div>
        <p className="text-neutral-500 text-sm">
          Catálogo digital de artículos y ediciones limitadas.
        </p>
      </header>

      <div className="flex justify-center mb-12">
        <a
          href="https://www.instagram.com/minienginescreations"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-800 hover:text-pink-600 transition-colors"
          aria-label="Visitar Instagram de MiniEngines Creations"
        >
          <Instagram size={28} />
        </a>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4 text-center">Categorías</h2>
        <div className="grid grid-cols-4 gap-4">
          {categories?.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>
    </main>
  );
}
