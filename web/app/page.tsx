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
      <section className="container grid items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div className="max-w-3xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#bcecf4] bg-white px-4 py-2 text-sm font-bold text-[#067a90]">
            <span className="h-2 w-2 rounded-full bg-[#0CC0DF]" aria-hidden />
            For Android and iOS
          </div>
          <h1 className="text-5xl font-bold leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            Card Nest
            <span className="mt-3 block text-3xl font-bold leading-[1.15] tracking-[-0.035em] text-[#079cb8] sm:text-4xl">
              Business card scanner and contact manager
            </span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#526a70] sm:text-xl">
            Card Nest is an Android and iOS business card scanner and contact manager. Take a photo of a physical
            business card and Card Nest uses your selected AI provider to extract contact details such as names, phone
            numbers, email addresses, company names, and addresses. You can review, organize, search, and securely sync
            your business contacts, then optionally add them to your phone’s Contacts app.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              className="focus-ring inline-flex min-h-12 items-center rounded-xl bg-[#079cb8] px-6 font-bold text-white transition hover:bg-[#067a90]"
              href="/#what-card-nest-does">
              See what Card Nest does
            </Link>
            <a
              className="focus-ring inline-flex min-h-12 items-center rounded-xl border border-[#bfd5da] bg-white px-6 font-bold text-[#334a50] transition hover:border-[#0CC0DF] hover:text-[#067a90]"
              href="https://github.com/Ytosko/Card-Nest"
              rel="noreferrer"
              target="_blank">
              View on GitHub
            </a>
          </div>
        </div>

        <div className="card-shadow relative overflow-hidden rounded-[2rem] border border-[#dbe8eb] bg-white p-7 sm:p-9">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#dff8fc]" aria-hidden />
          <div className="relative">
            <p className="text-sm font-bold tracking-[0.12em] text-[#079cb8]">HOW CARD NEST WORKS</p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em]">From paper card to saved contact.</h2>
            <div className="mt-9 space-y-4">
              {[
                'Photograph the front and back of a card',
                'Your AI provider extracts the contact details',
                'Search, sync, and export to phone Contacts',
              ].map((item) => (
                <div className="flex items-center gap-4 rounded-2xl border border-[#e0ebed] bg-[#f9fcfd] p-4" key={item}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#dff8fc] text-lg font-black text-[#067a90]">✓</span>
                  <span className="font-semibold">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dbe8eb] bg-white py-20" id="what-card-nest-does">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.12em] text-[#079cb8]">WHAT CARD NEST DOES</p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">
              Every step from a stack of cards to an organized contact library.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <article className="rounded-3xl border border-[#dbe8eb] bg-[#f9fcfd] p-7" key={feature.number}>
                <span className="text-sm font-black text-[#079cb8]">{feature.number}</span>
                <h3 className="mt-8 text-2xl font-bold tracking-[-0.035em]">{feature.title}</h3>
                <p className="mt-4 leading-7 text-[#60767c]">{feature.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-20" id="google-sign-in">
        <div className="card-shadow rounded-[2rem] border border-[#dbe8eb] bg-white p-8 sm:p-12">
          <p className="text-sm font-bold tracking-[0.12em] text-[#079cb8]">SIGNING IN WITH GOOGLE</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">Google Sign-In</h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#526a70]">
            Card Nest uses Google Sign-In to authenticate your Card Nest account and, when authorized, receive basic
            profile information such as your name, email address, and profile picture. Card Nest does not use Google
            Sign-In to access your Gmail, Google Drive, Google Calendar, or Google Contacts.
          </p>
          <p className="mt-4 max-w-3xl leading-8 text-[#60767c]">
            You can also sign in with an email address and password instead. Details are in the{' '}
            <Link className="focus-ring rounded font-semibold text-[#067a90] underline underline-offset-4 hover:text-[#079cb8]" href="/privacy">
              Card Nest Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="container pb-20">
        <div className="overflow-hidden rounded-[2rem] bg-[#0b1f24] px-7 py-12 text-white sm:px-12 sm:py-14">
          <div className="max-w-3xl">
            <p className="font-bold text-[#7be1f0]">OPEN SOURCE</p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.045em]">Follow Card Nest as it grows.</h2>
            <p className="mt-5 text-lg leading-8 text-[#cbd7db]">
              The Card Nest mobile app for Android and iOS, its hosted backend schema, deployment configuration, and
              engineering documentation live together in the public repository.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
