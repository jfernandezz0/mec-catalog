import { supabase } from './supabase';
import type { Category, Article } from './types';

export interface SafeCategoriesResult {
  categories: Category[];
  hasVisibilityColumn: boolean;
  hasDiscountColumns: boolean;
}

export async function safeFetchCategories(): Promise<SafeCategoriesResult> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, country_code, is_visible, discount_percent')
    .order('id', { ascending: true });

  if (error) {
    if (error.message.includes('is_visible') || error.message.includes('discount_percent')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('categories')
        .select('id, name, country_code, is_visible')
        .order('id', { ascending: true });

      if (fallbackError) {
        if (fallbackError.message.includes('is_visible')) {
          const { data: doubleFallback, error: doubleFallbackError } = await supabase
            .from('categories')
            .select('id, name, country_code')
            .order('id', { ascending: true });

          if (doubleFallbackError) {
            throw new Error(`Could not load categories: ${doubleFallbackError.message}`);
          }
          return {
            categories: (doubleFallback ?? []).map(c => ({ ...c, is_visible: true, discount_percent: null })),
            hasVisibilityColumn: false,
            hasDiscountColumns: false,
          };
        }
        throw new Error(`Could not load categories: ${fallbackError.message}`);
      }

      return {
        categories: (fallbackData ?? []).map(c => ({ ...c, discount_percent: null })),
        hasVisibilityColumn: true,
        hasDiscountColumns: false,
      };
    }
    throw new Error(`Could not load categories: ${error.message}`);
  }

  return {
    categories: data ?? [],
    hasVisibilityColumn: true,
    hasDiscountColumns: true,
  };
}

export interface SafeCategoriesWithCountResult {
  categories: (Category & { articles?: Array<{ count: number }> })[];
  hasVisibilityColumn: boolean;
}

export async function safeFetchCategoriesWithArticleCount(): Promise<SafeCategoriesWithCountResult> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, country_code, is_visible, articles(count)')
    .order('id', { ascending: true });

  if (error) {
    if (error.message.includes('is_visible')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('categories')
        .select('id, name, country_code, articles(count)')
        .order('id', { ascending: true });

      if (fallbackError) {
        throw new Error(`Could not load categories: ${fallbackError.message}`);
      }
      return {
        categories: (fallbackData ?? []).map(c => ({ ...c, is_visible: true })),
        hasVisibilityColumn: false,
      };
    }
    throw new Error(`Could not load categories: ${error.message}`);
  }

  return {
    categories: data ?? [],
    hasVisibilityColumn: true,
  };
}

export interface SafeArticlesResult {
  articles: Article[];
  hasDiscountColumns: boolean;
}

export async function safeFetchArticles(): Promise<SafeArticlesResult> {
  const { data, error } = await supabase
    .from('articles')
    .select('id, category_id, title, description, price, quantity, image_urls, frame_image_urls, sort_order, contact_clicks, share_clicks, views, discount_type, discount_value, is_visible')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    if (error.message.includes('is_visible') || error.message.includes('discount_type') || error.message.includes('discount_value')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('articles')
        .select('id, category_id, title, description, price, quantity, image_urls, frame_image_urls, sort_order, contact_clicks, share_clicks, views')
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });

      if (fallbackError) {
        throw new Error(`Could not load articles: ${fallbackError.message}`);
      }
      return {
        articles: (fallbackData ?? []).map(a => ({ ...a, discount_type: null, discount_value: null, is_visible: true })),
        hasDiscountColumns: false,
      };
    }
    throw new Error(`Could not load articles: ${error.message}`);
  }

  return {
    articles: (data ?? []).map(a => ({ ...a, is_visible: a.is_visible !== false })),
    hasDiscountColumns: true,
  };
}
