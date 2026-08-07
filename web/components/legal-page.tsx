import type { ReactNode } from 'react';

export function LegalPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <article className="container py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-bold tracking-[0.12em] text-[#079cb8]">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">{title}</h1>
        <p className="mt-5 text-lg leading-8 text-[#526a70]">{intro}</p>
        <p className="mt-4 text-sm text-[#60767c]">Last updated: August 7, 2026</p>
        <div className="mt-10 space-y-9 rounded-[2rem] border border-[#dbe8eb] bg-white p-7 leading-7 text-[#334a50] sm:p-10 [&_a]:font-semibold [&_a]:text-[#067a90] [&_a]:underline [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-[-0.03em] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          {children}
        </div>
      </div>
    </article>
  );
}
