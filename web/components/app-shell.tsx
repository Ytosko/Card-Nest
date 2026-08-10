'use client';

import { ContactRound, Home, ScanLine, Search, Settings, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { signOut } from '@/app/auth/actions';
import { Brand } from '@/components/brand';
import { ToastRegion } from '@/components/feedback';
import { NavigationProgress } from '@/components/navigation-progress';
import { UserAvatar } from '@/components/user-avatar';

const navigation = [
  { href: '/app', label: 'Overview', icon: Home },
  { href: '/app/contacts', label: 'Contacts', icon: ContactRound },
  { href: '/app/scan', label: 'Scan', icon: ScanLine },
  { href: '/app/search', label: 'Search', icon: Search },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

type AppShellProps = {
  avatarSources: string[];
  children: React.ReactNode;
  displayName: string;
  email: string;
};

export function AppShell({ avatarSources, children, displayName, email }: AppShellProps) {
  const pathname = usePathname();
  return <div className="app-frame">
    <NavigationProgress />
    <ToastRegion />
    <aside className="app-sidebar">
      <Brand className="app-logo" href="/app" />
      <nav aria-label="Card Nest workspace">{navigation.map(({ href, label, icon: Icon }) => {
        const active = href === '/app' ? pathname === href : pathname.startsWith(href);
        return <Link className={`app-nav-link ${active ? 'active' : ''}`} href={href} key={href}><Icon aria-hidden size={20} /><span>{label}</span></Link>;
      })}</nav>
      <Link aria-label="Open profile settings" className="sidebar-account" href="/app/settings/profile"><UserAvatar displayName={displayName} email={email} size="compact" sources={avatarSources} /><div className="account-details"><strong>{displayName}</strong><span>{email}</span></div></Link>
      <button className="lock-now" onClick={() => window.dispatchEvent(new CustomEvent('cardnest:web-lock'))}><ShieldCheck size={18} />Lock now</button>
      <form action={signOut} onSubmit={() => window.dispatchEvent(new CustomEvent('cardnest:web-lock', { detail: { clearAll: true } }))}><button className="signout-button">Sign out</button></form>
    </aside>
    <div className="app-content"><header className="mobile-app-header"><Brand /><div className="mobile-account-actions"><Link aria-label="Open profile settings" href="/app/settings/profile"><UserAvatar displayName={displayName} email={email} size="compact" sources={avatarSources} /></Link><button onClick={() => window.dispatchEvent(new CustomEvent('cardnest:web-lock'))} aria-label="Lock Card Nest"><ShieldCheck /></button></div></header><main>{children}</main></div>
    <nav className="mobile-app-nav" aria-label="Card Nest mobile workspace">{navigation.slice(0, 5).map(({ href, label, icon: Icon }) => <Link className={(href === '/app' ? pathname === href : pathname.startsWith(href)) ? 'active' : ''} href={href} key={href}><Icon aria-hidden size={21} /><span>{label}</span></Link>)}</nav>
  </div>;
}
