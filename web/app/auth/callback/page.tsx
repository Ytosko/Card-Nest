'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type CallbackState = 'checking' | 'success' | 'error';

type VerificationResponse =
  | {
      ok: true;
      flowType: string;
      session: { accessToken: string; refreshToken: string } | null;
    }
  | { ok: false; message: string };

const flowMessages: Record<string, string> = {
  email: 'Your email address is verified.',
  email_change: 'Your new email address is verified.',
  invite: 'Your invitation is accepted.',
  magiclink: 'Your secure sign-in link is verified.',
  recovery: 'Your password reset link is verified.',
  signup: 'Your Card Nest account is verified.',
};

function createAppLink(response: Extract<VerificationResponse, { ok: true }>) {
  if (!response.session) return 'cardnest://';

  const fragment = new URLSearchParams({
    access_token: response.session.accessToken,
    refresh_token: response.session.refreshToken,
    type: response.flowType,
  });

  return `cardnest://auth/callback#${fragment.toString()}`;
}

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>('checking');
  const [message, setMessage] = useState('Checking your secure Card Nest link…');
  const [appLink, setAppLink] = useState('cardnest://');

  useEffect(() => {
    const controller = new AbortController();
    let openTimer: number | undefined;

    async function verifyLink() {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/u, ''));
      // One-time hashes, session fragments, and provider errors are never kept
      // in browser history, including when the incoming link is malformed.
      window.history.replaceState({}, '', '/auth/callback');
      const suppliedError =
        search.get('error_description') ??
        search.get('error') ??
        hash.get('error_description') ??
        hash.get('error');

      if (suppliedError) {
        await Promise.resolve();
        setState('error');
        setMessage(suppliedError.replace(/\+/gu, ' '));
        return;
      }

      const tokenHash = search.get('token_hash');
      const type = search.get('type');
      if (!tokenHash || !type) {
        await Promise.resolve();
        setState('error');
        setMessage('This secure link is incomplete. Request a new email and try again.');
        return;
      }

      try {
        const verification = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenHash, type }),
          cache: 'no-store',
          signal: controller.signal,
        });
        const response = (await verification.json()) as VerificationResponse;

        if (!verification.ok || !response.ok) {
          throw new Error(response.ok ? 'This link could not be verified.' : response.message);
        }

        const nextAppLink = createAppLink(response);
        setAppLink(nextAppLink);
        setState('success');
        setMessage(`${flowMessages[response.flowType] ?? 'Your secure link is verified.'} Opening the Card Nest app…`);
        openTimer = window.setTimeout(() => window.location.assign(nextAppLink), 650);
      } catch (error) {
        if (controller.signal.aborted) return;
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Card Nest could not verify this link. Please request a new one.');
      }
    }

    void verifyLink();

    return () => {
      controller.abort();
      if (openTimer) window.clearTimeout(openTimer);
    };
  }, []);

  return (
    <section className="container grid min-h-[68vh] place-items-center py-16">
      <div className="card-shadow w-full max-w-xl rounded-[2rem] border border-[#dbe8eb] bg-white p-8 text-center sm:p-12">
        <div
          aria-hidden
          className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl font-black ${
            state === 'error' ? 'bg-[#fce4e8] text-[#c73a4a]' : 'bg-[#dff8fc] text-[#067a90]'
          }`}>
          {state === 'checking' ? '…' : state === 'error' ? '!' : '✓'}
        </div>
        <p className="mt-7 text-sm font-bold tracking-[0.12em] text-[#079cb8]">SECURE AUTH CALLBACK</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">
          {state === 'error' ? 'This link could not be verified' : state === 'checking' ? 'Verifying your link' : 'You’re verified'}
        </h1>
        <p aria-live="polite" className="mt-5 leading-7 text-[#60767c]">{message}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {state === 'success' ? (
            <a className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl bg-[#079cb8] px-6 font-bold text-white hover:bg-[#067a90]" href={appLink}>
              Open Card Nest
            </a>
          ) : null}
          <Link className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl border border-[#bfd5da] px-6 font-bold text-[#334a50] hover:border-[#0CC0DF]" href="/">
            Return home
          </Link>
        </div>
      </div>
    </section>
  );
}
