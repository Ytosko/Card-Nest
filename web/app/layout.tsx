import type { Metadata, Viewport } from 'next';

import { PageChrome } from '@/components/page-chrome';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';

import './globals.css';

const siteUrl = 'https://cardnest.ytosko.dev';

// Public pages must not be cacheable for a year: Google's verification crawler honors
// HTTP caching, and a stale year-long copy of the homepage caused repeated reviews of
// pre-fix content. Five minutes keeps pages fresh for crawlers at negligible cost.
export const revalidate = 300;

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Card Nest — Business card scanner and contact manager', template: '%s | Card Nest' },
  description:
    'Card Nest is an Android and iOS business card scanner and contact manager. Photograph business cards, extract contact details with your selected AI provider, organize and search your contacts, sync them securely across devices, and optionally add them to your phone’s Contacts app.',
  applicationName: 'Card Nest',
  // Next.js normalizes the root canonical to the no-trailing-slash form; for a domain
  // root both forms are the identical URL (empty path resolves to "/").
  alternates: { canonical: 'https://cardnest.ytosko.dev/' },
  icons: {
    icon: [{ url: '/cardnest-icon.png', sizes: '1024x1024', type: 'image/png' }],
    apple: [{ url: '/cardnest-icon.png', sizes: '1024x1024', type: 'image/png' }],
  },
  ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
  openGraph: {
    type: 'website',
    url: `${siteUrl}/`,
    siteName: 'Card Nest',
    title: 'Card Nest — Business card scanner and contact manager',
    description:
      'Photograph business cards, extract contact details with your selected AI provider, and keep every contact organized, searchable, and securely synced across Android and iOS.',
  },
  twitter: {
    card: 'summary',
    title: 'Card Nest — Business card scanner and contact manager',
    description:
      'Photograph business cards, extract contact details with your selected AI provider, and keep every contact organized, searchable, and securely synced across Android and iOS.',
  },
};

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#0CC0DF' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
        <PageChrome>{children}</PageChrome>
      </body>
    </html>
  );
}
