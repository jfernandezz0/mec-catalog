'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getFlagEmoji, formatPrice } from '@/lib/utils';
import { calculateDiscount } from '@/lib/discounts';
import { Category, Article } from '@/lib/types';



type SearchBarProps = {
  hidePrices?: boolean;
  generalDiscountPercent?: string;
};



export default function SearchBar({
  hidePrices = false,
  generalDiscountPercent = '',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Map<number, Category>>(new Map());
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // 1. Fetch categories on mount for quick lookup
  useEffect(() => {
    async function loadCategories() {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, country_code, discount_percent');
        if (!error && data) {
          const catMap = new Map<number, Category>();
          data.forEach((cat) => catMap.set(cat.id, cat));
          setCategories(catMap);
        }
      } catch (err) {
        console.error('Error fetching categories in search:', err);
      }
    }
    loadCategories();
  }, []);

  // 2. Click outside listener to close search results
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 3. Debounced search query fetching
  useEffect(() => {
    if (!query.trim()) {
      setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return;
    }

    setTimeout(() => {
      setLoading(true);
    }, 0);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const trimmed = query.trim();
        const { data, error } = await supabase
          .from('articles')
          .select('id, category_id, title, description, price, quantity, image_urls, discount_type, discount_value')
          .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
          .limit(6);

        if (!error && data) {
          setResults(data);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('Error searching articles:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md mx-auto mb-8 z-40 px-4">
      {/* Search Input Container */}
      <div className="relative flex items-center">
        <span className="absolute left-4 text-[color:var(--text-secondary)] opacity-70 pointer-events-none">
          <Search size={18} />
        </span>
        
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Busca tu vehículo o marca favorita aquí"
          className="w-full pl-10 pr-10 py-2.5 bg-[color:var(--bg-input)] border border-[color:var(--border-input)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 shadow-sm"
          style={{
            color: 'var(--text-primary)',
          }}
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 p-1 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors rounded-full hover:bg-[color:var(--border-card)]"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && query.trim() && (
        <div 
          className="absolute left-4 right-4 mt-2 bg-[color:var(--bg-card)] border border-[color:var(--border-card)] rounded-xl shadow-xl overflow-hidden backdrop-blur-md max-h-96 overflow-y-auto"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-card)',
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center p-6 text-sm text-[color:var(--text-secondary)] gap-2">
              <Loader2 className="animate-spin text-amber-500" size={16} />
              <span>Buscando...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-1 text-xs font-semibold text-[color:var(--text-tertiary)] uppercase tracking-wider">
                Vehículos encontrados ({results.length})
              </div>
              <ul className="mt-1 divide-y divide-[color:var(--border-card)]">
                {results.map((article) => {
                  const category = categories.get(article.category_id);
                  const imageUrl = article.image_urls?.[0];
                  const flag = category ? getFlagEmoji(category.country_code) : '';
                  const categoryName = category ? category.name : '';
                  
                  // Calculate discount
                  const discountInfo = calculateDiscount(
                    article.price,
                    article.discount_type,
                    article.discount_value,
                    category?.discount_percent,
                    generalDiscountPercent
                  );
                  const hasDiscount = discountInfo.appliedSource !== 'none';

                  return (
                    <li key={article.id}>
                      <Link
                        href={`/article/${article.id}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-[color:var(--bg-page)] transition-colors group"
                      >
                        {/* Article Image */}
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-[color:var(--border-card)] flex-shrink-0 bg-[color:var(--bg-page)]">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={article.title}
                              fill
                              sizes="48px"
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-[color:var(--text-tertiary)] bg-[color:var(--bg-page)]">
                              🚗
                            </div>
                          )}
                        </div>

                        {/* Title and Category */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold truncate text-[color:var(--text-primary)] group-hover:text-amber-500 transition-colors">
                            {article.title}
                          </h4>
                          {category && (
                            <p className="text-xs text-[color:var(--text-secondary)] flex items-center gap-1 mt-0.5">
                              <span className="text-sm leading-none">{flag}</span>
                              <span>{categoryName}</span>
                            </p>
                          )}
                        </div>

                        {/* Price & Stock status */}
                        <div className="text-right flex-shrink-0">
                          {article.quantity <= 0 ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-500">
                              Agotado
                            </span>
                          ) : !hidePrices ? (
                            <div className="flex flex-col items-end">
                              {hasDiscount && (
                                <span className="text-[10px] font-bold text-red-500 line-through">
                                  {formatPrice(discountInfo.originalPrice)}
                                </span>
                              )}
                              <span className="text-sm font-extrabold text-[color:var(--text-primary)]">
                                {formatPrice(discountInfo.finalPrice)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-500">
                              Disponible
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-[color:var(--text-secondary)]">
              No se encontraron vehículos o marcas para &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
