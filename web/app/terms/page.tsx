import type { Metadata } from 'next';

import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Terms of Use', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return (
    <LegalPage eyebrow="CLEAR EXPECTATIONS" intro="These terms govern access to the Card Nest website and application." title="Terms of Use">
      <section><h2>Using Card Nest</h2><p>You may use Card Nest only for lawful purposes and only with information you have the right to capture, store, process, and export.</p></section>
      <section><h2>Your account</h2><p>You are responsible for safeguarding your credentials and for activity performed through your account. Notify the project maintainers if you believe your account has been compromised.</p></section>
      <section><h2>Your content</h2><p>You retain responsibility for business-card images and contact information you upload. You grant the service the limited permission required to store and process that content for features you request.</p></section>
      <section><h2>Third-party services</h2><p>Card Nest relies on hosted infrastructure and may connect to AI providers using credentials you supply. Those providers have their own terms and privacy practices.</p></section>
      <section><h2>Availability and warranty</h2><p>The open-source software and website are provided on an “as is” and “as available” basis, without warranties to the maximum extent permitted by law.</p></section>
      <section><h2>Changes</h2><p>These terms may evolve with the product. Continued use after an update constitutes acceptance of the revised terms.</p></section>
    </LegalPage>
  );
}
