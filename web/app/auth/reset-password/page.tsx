import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import { updatePassword } from '../actions';

type Params = Promise<{ message?: string }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: Params }) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/auth?mode=signin&message=Your+reset+link+expired.+Request+a+new+one.');
  const params = await searchParams;
  return <main className="center-page"><section className="auth-card compact-card">
    <p className="eyebrow">SECURE PASSWORD RESET</p><h1>Choose a new password</h1>
    {params.message ? <div className="notice" role="alert">{params.message}</div> : null}
    <form action={updatePassword} className="form-stack">
      <label>New password<input autoComplete="new-password" minLength={8} name="password" required type="password" /></label>
      <label>Confirm new password<input autoComplete="new-password" minLength={8} name="confirmPassword" required type="password" /></label>
      <button className="button button-primary">Update password</button>
    </form>
  </section></main>;
}
