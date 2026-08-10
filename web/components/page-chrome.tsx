'use client';

import { usePathname } from 'next/navigation';

import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

export function PageChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const privateApp = pathname.startsWith('/app');
  const fullScreenAuth = pathname === '/auth' || pathname.startsWith('/auth/');
  if (privateApp || fullScreenAuth) return <>{children}</>;
  return <div className="page-shell flex min-h-screen flex-col"><SiteHeader /><main className="flex-1">{children}</main><SiteFooter /></div>;
}
