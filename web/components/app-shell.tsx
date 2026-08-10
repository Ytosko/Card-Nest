'use client';

import { ContactRound, Home, ScanLine, Search, Settings, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { signOut } from '@/app/auth/actions';
import { Brand } from '@/components/brand';

const navigation = [
  { href: '/app', label: 'Overview', icon: Home },
  { href: '/app/contacts', label: 'Contacts', icon: ContactRound },
  { href: '/app/scan', label: 'Scan', icon: ScanLine },
  { href: '/app/search', label: 'Search', icon: Search },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children, displayName, email }: { children: React.ReactNode; displayName: string; email: string }) {
  const pathname = usePathname();
  return <div className="app-frame">
    <aside className="app-sidebar">
      <Brand className="app-logo" href="/app" />
      <nav aria-label="Card Nest workspace">{navigation.map(({ href, label, icon: Icon }) => {
        const active = href === '/app' ? pathname === href : pathname.startsWith(href);
        return <Link className={`app-nav-link ${active ? 'active' : ''}`} href={href} key={href}><Icon aria-hidden size={20} /><span>{label}</span></Link>;
      })}</nav>
      <div className="sidebar-account"><div className="account-avatar">{displayName.slice(0, 1).toUpperCase()}</div><div><strong>{displayName}</strong><span>{email}</span></div></div>
      <button className="lock-now" onClick={() => window.dispatchEvent(new Event('cardnest:web-lock'))}><ShieldCheck size={18} />Lock now</button>
      <form action={signOut}><button className="signout-button">Sign out</button></form>
    </aside>
    <div className="app-content"><header className="mobile-app-header"><Brand /><button onClick={() => window.dispatchEvent(new Event('cardnest:web-lock'))} aria-label="Lock Card Nest"><ShieldCheck /></button></header><main>{children}</main></div>
    <nav className="mobile-app-nav" aria-label="Card Nest mobile workspace">{navigation.slice(0, 5).map(({ href, label, icon: Icon }) => <Link className={(href === '/app' ? pathname === href : pathname.startsWith(href)) ? 'active' : ''} href={href} key={href}><Icon aria-hidden size={21} /><span>{label}</span></Link>)}</nav>
  </div>;
}
