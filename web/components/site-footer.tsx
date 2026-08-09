import Link from 'next/link';

import { Brand } from './brand';

export function SiteFooter() {
  return (
    <footer className="border-t border-[#dbe8eb] bg-white">
      <div className="container flex flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-9">
        <Brand />
        <div className="flex flex-wrap items-center gap-4 text-sm text-[#60767c] sm:gap-6">
          <span>© {new Date().getUTCFullYear()} Card Nest</span>
          <Link className="focus-ring rounded-lg px-2 py-1 transition hover:text-[#067a90]" href="/privacy">Privacy</Link>
          <Link className="focus-ring rounded-lg px-2 py-1 transition hover:text-[#067a90]" href="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
