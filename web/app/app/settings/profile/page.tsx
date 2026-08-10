import { requireWebUser } from '@/lib/supabase/server';

import { requestEmailChange, saveProfile } from '../actions';

type Params = Promise<{ saved?: string; message?: string }>;
export default async function ProfileSettingsPage({ searchParams }: { searchParams: Params }) {
  const { supabase, user } = await requireWebUser(); const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user!.id).maybeSingle(); const params = await searchParams;
  return <section className="workspace-page narrow-page"><header className="workspace-header"><div><p className="eyebrow">ACCOUNT</p><h1>Profile & account</h1><p className="muted">The identity shown throughout Card Nest.</p></div></header>{params.saved ? <div className="notice success">Profile saved.</div> : null}{params.message ? <div className="notice">{params.message}</div> : null}<form action={saveProfile} className="panel form-stack"><h2>Profile details</h2><label>Display name<input autoComplete="name" name="displayName" defaultValue={profile?.display_name ?? ''} /></label><label>Email address<input disabled value={user?.email ?? ''} /></label><button className="button button-primary">Save profile</button></form><form action={requestEmailChange} className="panel form-stack"><h2>Change email</h2><p className="muted">Card Nest asks both addresses to approve a change.</p><label>New email address<input autoComplete="email" name="email" required type="email" /></label><button className="button button-secondary">Send approval emails</button></form></section>;
}
