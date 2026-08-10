import { redirect } from 'next/navigation';

import { UserAvatar } from '@/components/user-avatar';
import { getWebProfileIdentity } from '@/lib/web-profile';

import { removeProfileAvatar, requestEmailChange, saveProfile, updateProfileAvatar } from '../actions';

type Params = Promise<{ avatar?: string; saved?: string; message?: string }>;
export default async function ProfileSettingsPage({ searchParams }: { searchParams: Params }) {
  const identity = await getWebProfileIdentity();
  if (identity.status !== 'authenticated') redirect('/auth');
  const params = await searchParams;
  const { profile } = identity;
  return <section className="workspace-page narrow-page"><header className="workspace-header"><div><p className="eyebrow">ACCOUNT</p><h1>Profile & account</h1><p className="muted">The identity shown throughout Card Nest.</p></div></header>{params.saved ? <div className="notice success">Profile saved.</div> : null}{params.avatar === 'updated' ? <div className="notice success">Profile photo updated everywhere Card Nest syncs.</div> : null}{params.avatar === 'removed' ? <div className="notice success">Profile photo removed.</div> : null}{params.message ? <div className="notice" role="alert">{params.message}</div> : null}<section className="panel profile-photo-panel"><div className="profile-photo-preview"><UserAvatar displayName={profile.displayName} email={profile.email} size="large" sources={profile.avatarSources} /><div><h2>Profile photo</h2><p className="muted">This same private photo appears in the Card Nest mobile and web apps.</p></div></div><form action={updateProfileAvatar} className="profile-photo-actions"><label className="file-field">Choose a new photo<input accept="image/jpeg,image/png,image/webp" name="avatar" required type="file" /><small>JPEG, PNG, or WebP up to 5 MB.</small></label><button className="button button-primary">Upload photo</button></form>{profile.avatarPath ? <form action={removeProfileAvatar}><button className="text-button danger-text" type="submit">Remove Card Nest photo</button></form> : null}</section><form action={saveProfile} className="panel form-stack"><h2>Profile details</h2><label>Display name<input autoComplete="name" name="displayName" defaultValue={profile.displayName} /></label><label>Email address<input disabled value={profile.email} /></label><button className="button button-primary">Save profile</button></form><form action={requestEmailChange} className="panel form-stack"><h2>Change email</h2><p className="muted">Card Nest asks both addresses to approve a change.</p><label>New email address<input autoComplete="email" name="email" required type="email" /></label><button className="button button-secondary">Send approval emails</button></form></section>;
}
