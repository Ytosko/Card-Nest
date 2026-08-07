import Link from 'next/link';

const benefits = [
  {
    number: '01',
    title: 'Capture without the clutter',
    copy: 'Turn a physical card into a clean, searchable contact record without keeping another paper stack.',
  },
  {
    number: '02',
    title: 'Your library, safely synced',
    copy: 'Private cloud storage and offline-first foundations keep the contacts you value available when you need them.',
  },
  {
    number: '03',
    title: 'AI with your own keys',
    copy: 'Choose OpenAI or Gemini for extraction while keeping provider credentials under your control.',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="container grid items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div className="max-w-3xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#bcecf4] bg-white px-4 py-2 text-sm font-bold text-[#067a90]">
            <span className="h-2 w-2 rounded-full bg-[#0CC0DF]" aria-hidden />
            Open-source contact intelligence
          </div>
          <h1 className="text-5xl font-bold leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            The cards worth keeping, <span className="text-[#079cb8]">safely nested.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#526a70] sm:text-xl">
            Card Nest helps you scan, organize, search, back up, and export business cards from one private library.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <a
              className="focus-ring inline-flex min-h-12 items-center rounded-xl bg-[#079cb8] px-6 font-bold text-white transition hover:bg-[#067a90]"
              href="https://github.com/Ytosko/card-nest"
              rel="noreferrer"
              target="_blank">
              View on GitHub
            </a>
            <Link
              className="focus-ring inline-flex min-h-12 items-center rounded-xl border border-[#bfd5da] bg-white px-6 font-bold text-[#334a50] transition hover:border-[#0CC0DF] hover:text-[#067a90]"
              href="/#why-card-nest">
              Explore the foundation
            </Link>
          </div>
        </div>

        <div className="card-shadow relative overflow-hidden rounded-[2rem] border border-[#dbe8eb] bg-white p-7 sm:p-9">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#dff8fc]" aria-hidden />
          <div className="relative">
            <p className="text-sm font-bold tracking-[0.12em] text-[#079cb8]">PRIVATE BY DESIGN</p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em]">A calmer home for every connection.</h2>
            <div className="mt-9 space-y-4">
              {['Per-user cloud security', 'Resilient offline foundations', 'Portable contact exports'].map((item) => (
                <div className="flex items-center gap-4 rounded-2xl border border-[#e0ebed] bg-[#f9fcfd] p-4" key={item}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#dff8fc] text-lg font-black text-[#067a90]">✓</span>
                  <span className="font-semibold">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dbe8eb] bg-white py-20" id="why-card-nest">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.12em] text-[#079cb8]">WHY CARD NEST</p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Built for useful relationships, not data entry.</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {benefits.map((benefit) => (
              <article className="rounded-3xl border border-[#dbe8eb] bg-[#f9fcfd] p-7" key={benefit.number}>
                <span className="text-sm font-black text-[#079cb8]">{benefit.number}</span>
                <h3 className="mt-8 text-2xl font-bold tracking-[-0.035em]">{benefit.title}</h3>
                <p className="mt-4 leading-7 text-[#60767c]">{benefit.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-20">
        <div className="overflow-hidden rounded-[2rem] bg-[#0b1f24] px-7 py-12 text-white sm:px-12 sm:py-14">
          <div className="max-w-3xl">
            <p className="font-bold text-[#7be1f0]">THE FOUNDATION IS OPEN</p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.045em]">Follow Card Nest as it grows.</h2>
            <p className="mt-5 text-lg leading-8 text-[#cbd7db]">The mobile app, hosted Supabase schema, deployment configuration, and engineering documentation live together in the public repository.</p>
          </div>
        </div>
      </section>
    </>
  );
}
