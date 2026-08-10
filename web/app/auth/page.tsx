import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Brand } from '@/components/brand';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { signIn, signUp, startGoogleSignIn } from './actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ mode?: string; message?: string }>;

export default async function AuthPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/app');
  const signup = params.mode === 'signup';

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About Card Nest">
        <Link href="/" className="auth-brand"><Brand /></Link>
        <div className="auth-story-copy">
          <p className="eyebrow">YOUR CONTACT LIBRARY, EVERYWHERE</p>
          <h1>Turn business cards into useful relationships.</h1>
          <p>Securely scan, organize, search, and revisit every contact from your phone or browser.</p>
          <ul>
            <li>Private cloud library protected by per-user access policies</li>
            <li>Original card images and structured contact details together</li>
            <li>Your choice of OpenAI or Gemini with encrypted credentials</li>
          </ul>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">{signup ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</p>
          <h2>{signup ? 'Create your Card Nest' : 'Log in to Card Nest'}</h2>
          <p className="muted">{signup ? 'Start a private, searchable home for every business card.' : 'Your contacts are ready when you are.'}</p>
          {params.message ? <div className="notice" role="status">{params.message}</div> : null}
          <form action={signup ? signUp : signIn} className="form-stack">
            {signup ? <label>Display name<input autoComplete="name" name="displayName" placeholder="How should we address you?" /></label> : null}
            <label>Email address<input autoComplete="email" inputMode="email" name="email" placeholder="you@example.com" required type="email" /></label>
            <label>Password<input autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} name="password" placeholder="At least 8 characters" required type="password" /></label>
            <button className="button button-primary" type="submit">{signup ? 'Create account' : 'Log in'}</button>
          </form>
          <div className="auth-divider"><span>or</span></div>
          <form action={startGoogleSignIn}><button className="button button-secondary" type="submit">Continue with Google</button></form>
          <div className="auth-links">
            <Link href={signup ? '/auth?mode=signin' : '/auth?mode=signup'}>{signup ? 'Already have an account? Log in' : 'New to Card Nest? Create account'}</Link>
            {!signup ? <Link href="/auth/forgot">Forgot password?</Link> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
