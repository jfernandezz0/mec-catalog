import { supabase } from '@/lib/supabase';
import { safeFetchCategories } from '@/lib/supabase-helpers';
import { MetadataRoute } from 'next';

export const revalidate = 3600; // Revalidate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://mec-catalog.vercel.app';

  // 1. Static routes
  const routes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
      priority: 1.0,
    },
  ];

  try {
    // 2. Fetch categories safely
    const { categories, hasVisibilityColumn } = await safeFetchCategories();

    const visibleCategoryIds: number[] = [];

    if (categories) {
      categories.forEach((cat) => {
        if (!hasVisibilityColumn || cat.is_visible !== false) {
          visibleCategoryIds.push(cat.id);
          routes.push({
            url: `${baseUrl}/category/${cat.country_code.toLowerCase()}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
            priority: 0.8,
          });
        }
      });
    }

    // 3. Fetch articles belonging to visible categories
    if (visibleCategoryIds.length > 0) {
      const { data: articles, error: artError } = await supabase
        .from('articles')
        .select('id, is_visible')
        .in('category_id', visibleCategoryIds);

      if (!artError && articles) {
        (articles as Array<{ id: number; is_visible?: boolean }>)
          .filter((art) => art.is_visible !== false)
          .forEach((art) => {
            routes.push({
              url: `${baseUrl}/article/${art.id}`,
              lastModified: new Date(),
              changeFrequency: 'weekly' as 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
              priority: 0.7,
            });
          });
      } else if (artError && artError.message.includes('is_visible')) {
        const { data: fallbackArticles } = await supabase
          .from('articles')
          .select('id')
          .in('category_id', visibleCategoryIds);

        if (fallbackArticles) {
          fallbackArticles.forEach((art) => {
            routes.push({
              url: `${baseUrl}/article/${art.id}`,
              lastModified: new Date(),
              changeFrequency: 'weekly' as 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
              priority: 0.7,
            });
          });
        }
      }
    }
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }

  return routes;
}
