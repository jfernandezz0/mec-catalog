import { supabase } from '@/lib/supabase';
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
    // 2. Fetch categories
    const { data: categories } = await supabase
      .from('categories')
      .select('country_code');

    if (categories) {
      categories.forEach((cat) => {
        routes.push({
          url: `${baseUrl}/category/${cat.country_code.toLowerCase()}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
          priority: 0.8,
        });
      });
    }

    // 3. Fetch articles
    const { data: articles } = await supabase
      .from('articles')
      .select('id');

    if (articles) {
      articles.forEach((art) => {
        routes.push({
          url: `${baseUrl}/article/${art.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
          priority: 0.7,
        });
      });
    }
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }

  return routes;
}
