import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return { name: 'Card Nest', short_name: 'Card Nest', description: 'Private business card scanner and cloud contact library.', start_url: '/app', display: 'standalone', background_color: '#F7FBFC', theme_color: '#0CC0DF', icons: [{ src: '/cardnest-icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }, { src: '/cardnest-icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' }] };
}
