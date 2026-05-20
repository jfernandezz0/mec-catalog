'use client';

import { getFlagEmoji } from '@/lib/utils';
import Link from 'next/link';
import { useState } from 'react';

// Soft hover tones per country code, inspired by each flag's dominant colour
const hoverStyles: Record<string, { bg: string; border: string }> = {
  ALE: { bg: '#fffbeb', border: '#f59e0b' },   // Germany – amber/gold
  JAP: { bg: '#fef2f2', border: '#f87171' },   // Japan – red
  ITA: { bg: '#f0fdf4', border: '#4ade80' },   // Italy – green
  USA: { bg: '#eff6ff', border: '#60a5fa' },   // USA – blue
  FRA: { bg: '#eff6ff', border: '#3b82f6' },   // France – blue
  UK:  { bg: '#eef2ff', border: '#818cf8' },   // UK – indigo
  CRO: { bg: '#fef2f2', border: '#f87171' },   // Croatia – red
  SUE: { bg: '#fefce8', border: '#facc15' },   // Sweden – yellow
};

const defaultStyle = { bg: '#f9fafb', border: '#d1d5db' };

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
      className="p-4 h-28 rounded-xl flex flex-col items-center justify-center gap-2 shadow-sm text-center border transition-all duration-200"
      style={{
        backgroundColor: hovered ? style.bg : '#ffffff',
        borderColor: hovered ? style.border : '#e5e7eb',
        transform: hovered ? 'translateY(-2px) scale(1.03)' : 'translateY(0) scale(1)',
        boxShadow: hovered
          ? '0 8px 24px -4px rgba(0,0,0,0.12)'
          : '0 1px 3px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="text-3xl">{getFlagEmoji(category.country_code)}</span>
      <span className="text-sm font-semibold tracking-wide text-neutral-700">
        {category.name}
      </span>
    </Link>
  );
}
