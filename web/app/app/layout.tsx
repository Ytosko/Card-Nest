import { redirect } from 'next/navigation';
import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { WebPinGate } from '@/components/web-pin-gate';
import { requireWebUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PrivateAppLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireWebUser();
  if (auth.status === 'unauthenticated') redirect('/auth?mode=signin&message=Log+in+to+open+your+Card+Nest.');
  if (auth.status === 'unavailable') {
    return <main className="center-page"><section className="auth-card compact-card">
      <p className="eyebrow">SECURE SESSION CHECK</p>
      <h1>We could not verify your session</h1>
      <p className="muted" role="alert">Card Nest could not reach the authentication service. Your session has not been signed out.</p>
      <div className="button-row"><Link className="button button-primary" href="/app">Try again</Link><Link className="button button-secondary" href="/">Return home</Link></div>
    </section></main>;
  }
  const { supabase, user } = auth;
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle();
  const displayName = profile?.display_name || String(user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Card Nest user');
  return <WebPinGate email={user.email ?? ''} userId={user.id}><AppShell displayName={displayName} email={user.email ?? ''}>{children}</AppShell></WebPinGate>;
}
