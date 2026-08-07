import type { Metadata } from 'next';

import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="YOUR DATA, YOUR CONTROL" intro="This policy explains how Card Nest handles account data, scanned business cards, and service information." title="Privacy Policy">
      <section><h2>Information we process</h2><p>Card Nest processes account information you provide, business-card images and contact details you choose to store, and limited technical data required to operate and secure the service.</p></section>
      <section><h2>Google Sign-In</h2><p>Card Nest offers Google Sign-In as an optional way to authenticate your Card Nest account. When you choose to sign in with Google and authorize the request, Card Nest receives only your basic identity information from Google: your name, your email address, and your profile picture.</p><ul><li><strong>How it is used:</strong> this information is used solely to create and authenticate your Card Nest account, to display your name and avatar inside the app, and to associate your saved cards and contacts with your account.</li><li><strong>How it is stored:</strong> your Google-provided name and email address are stored in Card Nest&rsquo;s hosted authentication system (Supabase) alongside your account, protected by per-user access controls. Your Google password is never seen or stored by Card Nest.</li><li><strong>How it is shared:</strong> Google authentication data is never sold, never used for advertising, and never shared with third parties. It is used only to operate the Card Nest service for you.</li><li><strong>What is not accessed:</strong> Card Nest does not request or receive access to your Gmail, Google Contacts, Google Drive, Google Calendar, or any other Google account data.</li></ul><p>You may instead sign in with an email address and password at any time; Google Sign-In is never required.</p></section>
      <section><h2>How information is used</h2><ul><li>Provide authentication, cloud backup, search, and synchronization.</li><li>Process business cards with the AI provider you select.</li><li>Protect the service, diagnose failures, and prevent abuse.</li></ul></section>
      <section><h2>AI providers and your keys</h2><p>Card Nest is designed for bring-your-own-key AI processing. Provider keys belong to you and are intended to remain in secure device storage rather than the Card Nest database.</p></section>
      <section><h2>Storage and security</h2><p>Hosted Supabase provides authentication, database, and private image storage. User-owned records are protected with Row Level Security. No system can guarantee absolute security, but access is limited by design.</p></section>
      <section><h2>Your choices</h2><p>You can edit your profile, remove card records, sign out, and request account assistance. Contact the project through its GitHub repository for privacy questions.</p></section>
      <section><h2>Changes</h2><p>Material changes will be reflected on this page with an updated effective date.</p></section>
    </LegalPage>
  );
}
