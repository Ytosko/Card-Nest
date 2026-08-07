import type { MetadataRoute } from 'next';

const origin = 'https://cardnest.ytosko.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/privacy', '/terms'].map((path) => ({
    url: `${origin}${path}`,
    lastModified: new Date(),
    changeFrequency: path ? 'monthly' : 'weekly',
    priority: path ? 0.6 : 1,
  }));
}
