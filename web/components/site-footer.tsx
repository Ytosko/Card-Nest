import Link from 'next/link';

import { Brand } from './brand';

export function SiteFooter() {
  return (
    <footer className="border-t border-[#dbe8eb] bg-white">
      <div className="container flex flex-col gap-6 py-9 sm:flex-row sm:items-center sm:justify-between">
        <Brand />
        <div className="flex flex-wrap items-center gap-5 text-sm text-[#60767c]">
          <span>© {new Date().getUTCFullYear()} Card Nest</span>
          <Link className="focus-ring rounded hover:text-[#067a90]" href="/privacy">Privacy</Link>
          <Link className="focus-ring rounded hover:text-[#067a90]" href="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
