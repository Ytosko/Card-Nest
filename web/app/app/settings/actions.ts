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

export async function requestEmailChange(formData: FormData) {
  const { supabase, user } = await requireWebUser(); if (!user) redirect('/auth');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: 'https://cardnest.ytosko.dev/auth/callback?mode=web' });
  if (error) redirect(`/app/settings/profile?message=${encodeURIComponent(error.message)}`);
  redirect('/app/settings/profile?message=Approval+emails+sent.+Confirm+the+change+from+both+addresses.');
}
