import type { ReactNode } from 'react';

export function LegalPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <article className="container px-4 py-10 sm:px-6 sm:py-16 md:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold tracking-[0.12em] text-[#079cb8] sm:text-sm">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] sm:mt-3 sm:text-5xl">{title}</h1>
        <p className="mt-4 text-base leading-7 text-[#526a70] sm:mt-5 sm:text-lg sm:leading-8">{intro}</p>
        <p className="mt-3 text-xs text-[#60767c] sm:text-sm">Last updated: August 7, 2026</p>
        <div className="mt-8 space-y-7 rounded-[2rem] border border-[#dbe8eb] bg-white p-5 leading-7 text-[#334a50] sm:mt-10 sm:space-y-9 sm:p-10 [&_a]:font-semibold [&_a]:text-[#067a90] [&_a]:underline [&_h2]:mb-3 [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-[-0.03em] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 sm:[&_ul]:pl-6">
          {children}
        </div>
      </div>
    </article>
  );
}
