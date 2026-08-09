import Link from 'next/link';

const features = [
  {
    number: '01',
    title: 'Photograph business cards',
    copy: 'Capture the front and back of any physical business card with your phone camera — even offline. Card Nest keeps the original images safe.',
  },
  {
    number: '02',
    title: 'AI extracts the details',
    copy: 'Your selected AI provider (OpenAI or Google Gemini, with your own API key) reads each card and turns it into structured contact information: names, companies, phone numbers, emails, and addresses.',
  },
  {
    number: '03',
    title: 'Organize your contacts',
    copy: 'Every scanned card becomes a clean contact record with favorites, tags, notes, and support for multiple phone numbers and email addresses.',
  },
  {
    number: '04',
    title: 'Search everything instantly',
    copy: 'Find any contact by name, company, title, phone, email, address, or even text printed on the original card.',
  },
  {
    number: '05',
    title: 'Securely synced across devices',
    copy: 'Your library is stored privately in the cloud with per-user security. Sign in on a new phone and every card and contact is right where you left it.',
  },
  {
    number: '06',
    title: 'Export to your phone',
    copy: 'Optionally save any Card Nest contact — or many at once — straight into your phone’s Contacts app.',
  },
];

const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Card Nest',
  operatingSystem: 'Android, iOS',
  applicationCategory: 'BusinessApplication',
  url: 'https://cardnest.ytosko.dev/',
  description:
    'Card Nest is an Android and iOS business card scanner and contact manager. Take a photo of a physical business card and Card Nest uses your selected AI provider to extract contact details such as names, phone numbers, email addresses, company names, and addresses. You can review, organize, search, and securely sync your business contacts, then optionally add them to your phone’s Contacts app.',
};

export default function HomePage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
        type="application/ld+json"
      />
      <section className="container grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-28">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#bcecf4] bg-white px-3.5 py-1.5 text-xs font-bold text-[#067a90] sm:mb-7 sm:px-4 sm:py-2 sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-[#0CC0DF]" aria-hidden />
            For Android and iOS
          </div>
          {/* The H1 must be exactly the OAuth application name — no descriptor words —
              so automated name-match verification cannot read a different app name. */}
          <h1 className="text-4xl font-bold leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-7xl">Card Nest</h1>
          <p className="mt-3 text-2xl font-bold leading-[1.15] tracking-[-0.035em] text-[#079cb8] sm:text-4xl">
            Business card scanner and contact manager
          </p>
          <p className="mt-5 text-base leading-7 text-[#526a70] sm:mt-7 sm:text-xl sm:leading-8">
            Card Nest is an Android and iOS business card scanner and contact manager. Take a photo of a physical
            business card and Card Nest uses your selected AI provider to extract contact details such as names, phone
            numbers, email addresses, company names, and addresses. You can review, organize, search, and securely sync
            your business contacts, then optionally add them to your phone’s Contacts app.
          </p>
          <div className="mt-8 flex flex-col gap-3.5 sm:mt-9 sm:flex-row sm:flex-wrap sm:gap-4">
            <Link
              className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl bg-[#079cb8] px-6 font-bold text-white transition hover:bg-[#067a90] active:scale-98"
              href="/#what-card-nest-does">
              See what Card Nest does
            </Link>
            <a
              className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl border border-[#bfd5da] bg-white px-6 font-bold text-[#334a50] transition hover:border-[#0CC0DF] hover:text-[#067a90]"
              href="https://github.com/Ytosko/Card-Nest"
              rel="noreferrer"
              target="_blank">
              View on GitHub
            </a>
          </div>
        </div>

        <div className="card-shadow relative overflow-hidden rounded-[2rem] border border-[#dbe8eb] bg-white p-6 sm:p-9">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#dff8fc]" aria-hidden />
          <div className="relative">
            <p className="text-xs font-bold tracking-[0.12em] text-[#079cb8] sm:text-sm">HOW CARD NEST WORKS</p>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] sm:mt-4 sm:text-3xl">From paper card to saved contact.</h2>
            <div className="mt-7 space-y-3.5 sm:mt-9 sm:space-y-4">
              {[
                'Photograph the front and back of a card',
                'Your AI provider extracts the contact details',
                'Search, sync, and export to phone Contacts',
              ].map((item) => (
                <div className="flex items-center gap-3.5 rounded-2xl border border-[#e0ebed] bg-[#f9fcfd] p-3.5 sm:gap-4 sm:p-4" key={item}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#dff8fc] text-base font-black text-[#067a90] sm:h-9 sm:w-9 sm:text-lg">✓</span>
                  <span className="text-sm font-semibold sm:text-base">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dbe8eb] bg-white py-14 sm:py-20" id="what-card-nest-does">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.12em] text-[#079cb8] sm:text-sm">WHAT CARD NEST DOES</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.045em] sm:mt-3 sm:text-5xl">
              Every step from a stack of cards to an organized contact library.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article className="rounded-3xl border border-[#dbe8eb] bg-[#f9fcfd] p-6 sm:p-7" key={feature.number}>
                <span className="text-sm font-black text-[#079cb8]">{feature.number}</span>
                <h3 className="mt-6 text-xl font-bold tracking-[-0.035em] sm:mt-8 sm:text-2xl">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#60767c] sm:mt-4 sm:text-base sm:leading-7">{feature.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-14 sm:py-20" id="google-sign-in">
        <div className="card-shadow rounded-[2rem] border border-[#dbe8eb] bg-white p-6 sm:p-12">
          <p className="text-xs font-bold tracking-[0.12em] text-[#079cb8] sm:text-sm">SIGNING IN WITH GOOGLE</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.045em] sm:mt-3 sm:text-4xl">Google Sign-In</h2>
          <p className="mt-5 text-base leading-7 text-[#526a70] sm:mt-6 sm:text-lg sm:leading-8">
            Card Nest uses Google Sign-In to authenticate your Card Nest account and, when authorized, receive basic
            profile information such as your name, email address, and profile picture. Card Nest does not use Google
            Sign-In to access your Gmail, Google Drive, Google Calendar, or Google Contacts.
          </p>
          <p className="mt-4 text-sm leading-7 text-[#60767c] sm:text-base sm:leading-8">
            You can also sign in with an email address and password instead. Details are in the{' '}
            <Link className="focus-ring rounded font-semibold text-[#067a90] underline underline-offset-4 hover:text-[#079cb8]" href="/privacy">
              Card Nest Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="container pb-14 sm:pb-20">
        <div className="overflow-hidden rounded-[2rem] bg-[#0b1f24] px-6 py-10 text-white sm:px-12 sm:py-14">
          <div className="max-w-3xl">
            <p className="text-xs font-bold text-[#7be1f0] sm:text-sm">OPEN SOURCE</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.045em] sm:mt-3 sm:text-4xl">Follow Card Nest as it grows.</h2>
            <p className="mt-4 text-base leading-7 text-[#cbd7db] sm:mt-5 sm:text-lg sm:leading-8">
              The Card Nest mobile app for Android and iOS, its hosted backend schema, deployment configuration, and
              engineering documentation live together in the public repository.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
