import { redirect } from 'next/navigation';
import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { WebPinGate } from '@/components/web-pin-gate';
import { getWebProfileIdentity } from '@/lib/web-profile';

export const dynamic = 'force-dynamic';

export default async function PrivateAppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getWebProfileIdentity();
  if (auth.status === 'unauthenticated') redirect('/auth?mode=signin&message=Log+in+to+open+your+Card+Nest.');
  if (auth.status === 'unavailable') {
    return <main className="center-page"><section className="auth-card compact-card">
      <p className="eyebrow">SECURE SESSION CHECK</p>
      <h1>We could not verify your session</h1>
      <p className="muted" role="alert">Card Nest could not reach the authentication service. Your session has not been signed out.</p>
      <div className="button-row"><Link className="button button-primary" href="/app">Try again</Link><Link className="button button-secondary" href="/">Return home</Link></div>
    </section></main>;
  }
  const { profile, user } = auth;
  return <WebPinGate email={profile.email} userId={user.id}><AppShell avatarSources={profile.avatarSources} displayName={profile.displayName} email={profile.email}>{children}</AppShell></WebPinGate>;
}
