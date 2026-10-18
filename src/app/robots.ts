import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/checkout', '/invoice'],
    },
    sitemap: 'https://mec-catalog.vercel.app/sitemap.xml',
  }
}
