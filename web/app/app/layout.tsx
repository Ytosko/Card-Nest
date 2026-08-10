import { redirect } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { WebPinGate } from '@/components/web-pin-gate';
import { requireWebUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PrivateAppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireWebUser();
  if (!user) redirect('/auth?mode=signin&message=Log+in+to+open+your+Card+Nest.');
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle();
  const displayName = profile?.display_name || String(user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Card Nest user');
  return <WebPinGate email={user.email ?? ''} userId={user.id}><AppShell displayName={displayName} email={user.email ?? ''}>{children}</AppShell></WebPinGate>;
}
