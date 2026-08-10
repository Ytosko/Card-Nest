'use server';

import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

const productionOrigin = 'https://cardnest.ytosko.dev';
const webAppCallback = `${productionOrigin}/auth/callback?next=%2Fapp`;

function authUrl(mode: string, message?: string) {
  const params = new URLSearchParams({ mode });
  if (message) params.set('message', message.slice(0, 240));
  return `/auth?${params.toString()}`;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) redirect(authUrl('signin', 'Enter your email address and password.'));

  const supabase = await createServerSupabaseClient({ requireCookieWrites: true });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const message = error.message.toLowerCase().includes('invalid login')
      ? 'That email or password is not correct.'
      : error.message.toLowerCase().includes('email not confirmed')
        ? 'Confirm your email address before signing in.'
        : 'Sign-in could not be completed. Check your connection and try again.';
    redirect(authUrl('signin', message));
  }
  redirect('/app');
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 120);
  if (!email || password.length < 8) {
    redirect(authUrl('signup', 'Use a valid email address and a password with at least 8 characters.'));
  }

  const supabase = await createServerSupabaseClient({ requireCookieWrites: true });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: webAppCallback,
      data: { display_name: displayName || null },
    },
  });
  if (error) redirect(authUrl('signup', error.message));
  if (data.session) redirect('/app');
  redirect(authUrl('signin', 'Check your inbox and confirm your Card Nest account, then sign in.'));
}

export async function startGoogleSignIn() {
  const supabase = await createServerSupabaseClient({ requireCookieWrites: true });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: webAppCallback, skipBrowserRedirect: true },
  });
  if (error || !data.url) redirect(authUrl('signin', 'Google sign-in could not be started.'));
  redirect(data.url);
}

export async function sendPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) redirect('/auth/forgot?message=Enter+your+email+address.');
  const supabase = await createServerSupabaseClient({ requireCookieWrites: true });
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: webAppCallback });
  redirect('/auth/forgot?sent=true');
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');
  if (password.length < 8 || password !== confirm) {
    redirect('/auth/reset-password?message=Passwords+must+match+and+contain+at+least+8+characters.');
  }
  const supabase = await createServerSupabaseClient({ requireCookieWrites: true });
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/auth/reset-password?message=${encodeURIComponent(error.message)}`);
  redirect('/app/settings/security?password=updated');
}

export async function signOut() {
  const supabase = await createServerSupabaseClient({ requireCookieWrites: true });
  await supabase.auth.signOut();
  redirect('/auth?mode=signin&message=You+have+been+signed+out.');
}
