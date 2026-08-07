import type { Metadata, Viewport } from 'next';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

import './globals.css';

const siteUrl = 'https://cardnest.ytosko.dev';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Card Nest — Your private business card library', template: '%s | Card Nest' },
  description: 'An open-source, AI-powered business card scanner and cloud contact library for Android and iOS.',
  applicationName: 'Card Nest',
  alternates: { canonical: '/' },
  icons: { icon: '/logo.svg', apple: '/logo.svg' },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'Card Nest',
    title: 'Card Nest — The cards worth keeping, safely nested',
    description: 'Scan, organize, search, back up, and export physical business cards.',
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
