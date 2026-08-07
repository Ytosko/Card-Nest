import type { Metadata, Viewport } from 'next';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

import './globals.css';

const siteUrl = 'https://cardnest.ytosko.dev';

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Card Nest — Turn business cards into searchable contacts', template: '%s | Card Nest' },
  description:
    'Card Nest is a business card scanner for Android and iOS. Photograph business cards, extract contact details with your own AI provider, organize and search your contacts, sync them securely across devices, and export them to your phone.',
  applicationName: 'Card Nest',
  alternates: { canonical: '/' },
  icons: { icon: '/logo.svg', apple: '/logo.svg' },
  ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'Card Nest',
    title: 'Card Nest — Turn business cards into searchable contacts',
    description:
      'Photograph business cards, extract contact details with your own AI provider, and keep every contact organized, searchable, and securely synced across Android and iOS.',
  },
};

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#0CC0DF' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
