'use client';

import { getFlagEmoji } from '@/lib/utils';
import Link from 'next/link';
import { useState } from 'react';

// Soft hover tones per country code, inspired by each flag's dominant colour (uses CSS variables for dark mode support)
const hoverStyles: Record<string, { bg: string; border: string }> = {
  ALE: { bg: 'var(--cc-hover-bg-ALE, #fffbeb)', border: 'var(--cc-hover-border-ALE, #f59e0b)' },   // Germany
  JAP: { bg: 'var(--cc-hover-bg-JAP, #fef2f2)', border: 'var(--cc-hover-border-JAP, #f87171)' },   // Japan
  ITA: { bg: 'var(--cc-hover-bg-ITA, #f0fdf4)', border: 'var(--cc-hover-border-ITA, #4ade80)' },   // Italy
  USA: { bg: 'var(--cc-hover-bg-USA, #eff6ff)', border: 'var(--cc-hover-border-USA, #60a5fa)' },   // USA
  FRA: { bg: 'var(--cc-hover-bg-FRA, #eff6ff)', border: 'var(--cc-hover-border-FRA, #3b82f6)' },   // France
  UK:  { bg: 'var(--cc-hover-bg-UK, #eef2ff)',  border: 'var(--cc-hover-border-UK, #818cf8)' },    // UK
  CRO: { bg: 'var(--cc-hover-bg-CRO, #fef2f2)', border: 'var(--cc-hover-border-CRO, #f87171)' },   // Croatia
  SUE: { bg: 'var(--cc-hover-bg-SUE, #fefce8)', border: 'var(--cc-hover-border-SUE, #facc15)' },   // Sweden
  ES:  { bg: 'var(--cc-hover-bg-ES, #fff7ed)',  border: 'var(--cc-hover-border-ES, #ea580c)' },    // Spain
  ESP: { bg: 'var(--cc-hover-bg-ES, #fff7ed)',  border: 'var(--cc-hover-border-ES, #ea580c)' },    // Spain (Alias)
  KR:  { bg: 'var(--cc-hover-bg-KR, #f0f9ff)',  border: 'var(--cc-hover-border-KR, #0284c7)' },    // Korea
  KOR: { bg: 'var(--cc-hover-bg-KR, #f0f9ff)',  border: 'var(--cc-hover-border-KR, #0284c7)' },    // Korea (Alias)
};

const defaultStyle = { bg: 'var(--bg-page, #f9fafb)', border: 'var(--border-card, #d1d5db)' };

type Category = {
  id: number;
  name: string;
  country_code: string;
};

export default function CategoryCard({ category }: { category: Category }) {
  const [hovered, setHovered] = useState(false);
  const style = hoverStyles[category.country_code.toUpperCase()] ?? defaultStyle;

  return (
    <Link
      href={`/category/${category.country_code.toLowerCase()}`}
      className="p-4 h-28 rounded-xl flex flex-col items-center justify-center gap-2 text-center border transition-all duration-200"
      style={{
        backgroundColor: hovered ? style.bg : 'var(--bg-card-glass)',
        borderColor: hovered ? style.border : 'var(--border-card-glass)',
        backdropFilter: hovered ? 'none' : 'blur(12px)',
        WebkitBackdropFilter: hovered ? 'none' : 'blur(12px)',
        transform: hovered ? 'translateY(-2px) scale(1.03)' : 'translateY(0) scale(1)',
        boxShadow: hovered ? 'var(--shadow-hover)' : 'var(--shadow-glass)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="text-3xl">{getFlagEmoji(category.country_code)}</span>
      <span className="text-sm font-semibold tracking-wide text-[color:var(--text-primary)] opacity-90">
        {category.name}
      </span>
    </Link>
  );
}
