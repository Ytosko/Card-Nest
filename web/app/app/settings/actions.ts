'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireWebUser } from '@/lib/supabase/server';

export async function saveProfile(formData: FormData) {
  const { supabase, user } = await requireWebUser(); if (!user) redirect('/auth');
  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 120) || null;
  const { error } = await supabase.from('profiles').upsert({ user_id: user.id, display_name: displayName }, { onConflict: 'user_id' });
  if (error) throw new Error('Card Nest could not update your profile.');
  await supabase.auth.updateUser({ data: { display_name: displayName } }); revalidatePath('/app', 'layout'); redirect('/app/settings/profile?saved=true');
}

const avatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function updateProfileAvatar(formData: FormData) {
  const { supabase, user } = await requireWebUser();
  if (!user) redirect('/auth');

  const avatar = formData.get('avatar');
  if (!(avatar instanceof File) || avatar.size === 0) {
    redirect('/app/settings/profile?message=Choose+an+image+to+upload.');
  }
  if (!avatarTypes.has(avatar.type)) {
    redirect('/app/settings/profile?message=Use+a+JPEG%2C+PNG%2C+or+WebP+image.');
  }
  if (avatar.size > 5 * 1024 * 1024) {
    redirect('/app/settings/profile?message=Profile+photos+must+be+5+MB+or+smaller.');
  }

  const { data: currentProfile } = await supabase.from('profiles').select('avatar_path').eq('user_id', user.id).maybeSingle();
  const previousPath = currentProfile?.avatar_path ?? null;
  // Keep the established mobile path so both clients overwrite and read one object.
  // Supabase serves the declared content type, so PNG/WebP uploads remain valid.
  const nextPath = `${user.id}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('profile-avatars')
    .upload(nextPath, await avatar.arrayBuffer(), { cacheControl: '0', contentType: avatar.type, upsert: true });
  if (uploadError) redirect('/app/settings/profile?message=Card+Nest+could+not+upload+that+photo.');

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ user_id: user.id, avatar_path: nextPath }, { onConflict: 'user_id' });
  if (profileError) {
    if (nextPath !== previousPath) await supabase.storage.from('profile-avatars').remove([nextPath]);
    redirect('/app/settings/profile?message=Card+Nest+could+not+save+that+photo.');
  }
  if (previousPath && previousPath !== nextPath) {
    await supabase.storage.from('profile-avatars').remove([previousPath]);
  }

  revalidatePath('/app', 'layout');
  redirect('/app/settings/profile?avatar=updated');
}

export async function removeProfileAvatar() {
  const { supabase, user } = await requireWebUser();
  if (!user) redirect('/auth');

  const { data: profile } = await supabase.from('profiles').select('avatar_path').eq('user_id', user.id).maybeSingle();
  const avatarPath = profile?.avatar_path ?? null;
  const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('user_id', user.id);
  if (error) redirect('/app/settings/profile?message=Card+Nest+could+not+remove+that+photo.');
  if (avatarPath) await supabase.storage.from('profile-avatars').remove([avatarPath]);

  revalidatePath('/app', 'layout');
  redirect('/app/settings/profile?avatar=removed');
}

export async function requestEmailChange(formData: FormData) {
  const { supabase, user } = await requireWebUser(); if (!user) redirect('/auth');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: 'https://cardnest.ytosko.dev/auth/callback?next=%2Fapp%2Fsettings%2Fprofile' });
  if (error) redirect(`/app/settings/profile?message=${encodeURIComponent(error.message)}`);
  redirect('/app/settings/profile?message=Approval+emails+sent.+Confirm+the+change+from+both+addresses.');
}
