'use client';

import dynamic from 'next/dynamic';

type Category = {
  id: number;
  name: string;
  country_code: string;
  articles?: Array<{ count: number }>;
};

interface GlobeWrapperProps {
  categories: Category[];
}

// Dynamically import the heavy Three.js Globe component with ssr disabled
const DynamicGlobe = dynamic(() => import('./Globe'), {
  ssr: false,
  loading: () => (
    <div className="w-full flex flex-col items-center justify-center py-6 gap-4">
      <div className="relative w-full h-[480px] sm:h-[560px] md:h-[660px] rounded-3xl border border-[color:var(--border-card-glass)] bg-[color:var(--bg-card-glass)] flex items-center justify-center shadow-inner animate-pulse">
        <span className="text-[color:var(--text-secondary)] text-sm font-semibold tracking-wider uppercase">
          Iniciando Planeta...
        </span>
      </div>
    </div>
  ),
});

export default function GlobeWrapper({ categories }: GlobeWrapperProps) {
  return <DynamicGlobe categories={categories} />;
}
