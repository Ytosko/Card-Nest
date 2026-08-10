import type { EmailOtpType } from '@supabase/supabase-js';
import Link from 'next/link';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Params = Promise<Record<string, string | string[] | undefined>>;

const allowedOtpTypes = new Set<EmailOtpType>(['email', 'email_change', 'invite', 'magiclink', 'recovery', 'signup']);

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeMessage(value: string | undefined) {
  return value?.replace(/\+/gu, ' ').slice(0, 260);
}

export default async function AuthCallbackPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const suppliedError = safeMessage(first(params.error_description) ?? first(params.error));
  const code = first(params.code);
  const tokenHash = first(params.token_hash);
  const rawType = first(params.type);
  const pinResetNonce = first(params.pin_reset_nonce);
  const supabase = await createServerSupabaseClient();
  let errorMessage = suppliedError;
  const flowType = rawType ?? 'signin';

  if (!errorMessage && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) errorMessage = 'This sign-in link expired or has already been used. Start again from Card Nest.';
  } else if (!errorMessage && tokenHash && rawType && allowedOtpTypes.has(rawType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType as EmailOtpType });
    if (error) errorMessage = 'This secure email link expired or has already been used. Request a fresh link and try again.';
  } else if (!errorMessage) {
    errorMessage = 'This secure link is incomplete. Start the sign-in or recovery flow again.';
  }

  const { data } = errorMessage ? { data: { session: null } } : await supabase.auth.getSession();
  const session = data.session;
  const appLink = session
    ? `cardnest://auth/callback#${new URLSearchParams({ access_token: session.access_token, refresh_token: session.refresh_token, type: flowType }).toString()}`
    : 'cardnest://';
  const safePinResetNonce = pinResetNonce && /^[A-Za-z0-9_-]{40,64}$/u.test(pinResetNonce) ? pinResetNonce : null;
  const webTarget = safePinResetNonce && session ? `/app/reset-pin?nonce=${encodeURIComponent(safePinResetNonce)}` : flowType === 'recovery' ? '/auth/reset-password' : '/app';

  return <main className="center-page"><section className="auth-card compact-card callback-card">
    <div className={`status-mark ${errorMessage ? 'error' : ''}`} aria-hidden>{errorMessage ? '!' : '✓'}</div>
    <p className="eyebrow">SECURE CARD NEST CALLBACK</p>
    <h1>{errorMessage ? 'This link could not be verified' : flowType === 'recovery' ? 'Reset link verified' : 'You’re verified'}</h1>
    <p className="muted" role={errorMessage ? 'alert' : 'status'}>{errorMessage ?? (flowType === 'recovery' ? 'Continue in this browser to choose a new password, or open the mobile app.' : 'Your Card Nest session is ready. Choose where to continue.')}</p>
    <div className="button-row">
      {!errorMessage ? <Link className="button button-primary" href={webTarget}>{flowType === 'recovery' ? 'Reset password on web' : 'Continue to web app'}</Link> : null}
      {!errorMessage ? <a className="button button-secondary" href={appLink}>Open mobile app</a> : null}
      {errorMessage ? <Link className="button button-primary" href="/auth?mode=signin">Return to login</Link> : null}
    </div>
  </section></main>;
}
