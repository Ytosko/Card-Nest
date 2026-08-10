'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Brand } from './brand';

const links = [
  { href: '/#what-card-nest-does', label: 'What Card Nest does' },
  { href: '/#google-sign-in', label: 'Google Sign-In' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && mobileMenuOpen) {
        closeMenu();
      }
    }

    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen, closeMenu]);

  return (
    <header className="sticky top-0 z-40 border-b border-[#dbe8eb]/80 bg-white/90 backdrop-blur-xl">
      <div className="container flex min-h-16 items-center justify-between gap-4 py-3 sm:min-h-20 sm:py-0">
        <Brand />

        {/* Desktop Navigation */}
        <nav aria-label="Primary navigation" className="hidden md:flex md:items-center md:gap-1 lg:gap-2">
          {links.map((link) => (
            <Link
              className="focus-ring whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold text-[#486168] transition hover:bg-[#e7f9fc] hover:text-[#067a90]"
              href={link.href}
              key={link.href}>
              {link.label}
            </Link>
          ))}
          <Link
            className="focus-ring ml-1 inline-flex min-h-11 items-center rounded-xl bg-[#0CC0DF] px-4 text-sm font-bold text-[#052f36] transition hover:bg-[#08afcb]"
            href="/auth?mode=signin">
            Log in
          </Link>
        </nav>

        {/* Mobile Hamburger Toggle Button */}
        <button
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl text-[#334a50] transition hover:bg-[#e7f9fc] hover:text-[#067a90] active:scale-95 md:hidden"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          type="button">
          {mobileMenuOpen ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Navigation Drawer Overlay */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            aria-hidden
            className="fixed inset-0 bg-[#0b1f24]/50 backdrop-blur-sm transition-opacity"
            onClick={closeMenu}
          />

          {/* Drawer Content Sheet */}
          <div
            aria-label="Mobile navigation"
            aria-modal="true"
            className="fixed inset-x-0 top-0 border-b border-[#dbe8eb] bg-white p-6 shadow-2xl animate-in slide-in-from-top-4 duration-200"
            role="dialog">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                aria-label="Close menu"
                className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl text-[#334a50] transition hover:bg-[#e7f9fc] hover:text-[#067a90]"
                onClick={closeMenu}
                type="button">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <nav aria-label="Mobile primary navigation" className="mt-6 flex flex-col gap-1.5">
              {links.map((link) => (
                <Link
                  className="focus-ring flex min-h-12 items-center rounded-xl px-4 text-base font-bold text-[#334a50] transition hover:bg-[#e7f9fc] hover:text-[#067a90] active:bg-[#dff8fc]"
                  href={link.href}
                  key={link.href}
                  onClick={closeMenu}>
                  {link.label}
                </Link>
              ))}
              <Link
                className="focus-ring mt-2 flex min-h-12 items-center justify-center rounded-xl bg-[#0CC0DF] px-4 text-base font-bold text-[#052f36] transition hover:bg-[#08afcb]"
                href="/auth?mode=signin"
                onClick={closeMenu}>
                Log in to web app
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
