'use client';

import { getFlagEmoji } from '@/lib/utils';
import Link from 'next/link';
import { Category } from '@/lib/types';

export default function CategoryCard({ category }: { category: Category }) {
  const countryUpper = category.country_code.toUpperCase();

  return (
    <Link
      href={`/category/${category.country_code.toLowerCase()}`}
      className={`p-4 h-28 rounded-xl flex flex-col items-center justify-center gap-2 text-center transition-all duration-300 neon-card neon-card-${countryUpper}`}
    >
      <span className="text-3xl">{getFlagEmoji(category.country_code)}</span>
      <span className="text-sm font-semibold tracking-wide text-[color:var(--text-primary)] opacity-90">
        {category.name}
      </span>
    </Link>
  );
}

