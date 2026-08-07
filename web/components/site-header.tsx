import Link from 'next/link';

import { Brand } from './brand';

const links = [
  { href: '/#what-card-nest-does', label: 'What Card Nest does' },
  { href: '/#google-sign-in', label: 'Google Sign-In' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-[#dbe8eb]/80 bg-white/80 backdrop-blur-xl">
      <div className="container flex min-h-20 items-center justify-between gap-5">
        <Brand />
        <nav aria-label="Primary navigation" className="flex items-center gap-1 sm:gap-3">
          {links.map((link) => (
            <Link
              className="focus-ring rounded-xl px-3 py-3 text-sm font-semibold text-[#486168] transition hover:bg-[#e7f9fc] hover:text-[#067a90]"
              href={link.href}
              key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
