'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type CallbackState = 'connecting' | 'success' | 'error';

type ErrorKind =
  | 'cancelled'
  | 'expired'
  | 'invalid'
  | 'failed';

const errorCopy: Record<ErrorKind, { title: string; body: string }> = {
  cancelled: {
    title: 'Sign-in was cancelled',
    body: 'No problem — nothing was changed. Return to the Card Nest app and try again whenever you like.',
  },
  expired: {
    title: 'This sign-in link expired',
    body: 'For your security, sign-in links only work for a short time. Start Google sign-in again from the Card Nest app.',
  },
  invalid: {
    title: 'This sign-in link is incomplete',
    body: 'Something interrupted the sign-in before it finished. Start Google sign-in again from the Card Nest app.',
  },
  failed: {
    title: 'Google sign-in could not be completed',
    body: 'Your account is safe. Return to the Card Nest app and try signing in again.',
  },
};

function classifyError(error: string | null, errorCode: string | null, description: string | null): ErrorKind {
  const haystack = `${error ?? ''} ${errorCode ?? ''} ${description ?? ''}`.toLowerCase();
  if (haystack.includes('access_denied') || haystack.includes('cancel') || haystack.includes('denied')) {
    return 'cancelled';
  }
  if (haystack.includes('expired') || haystack.includes('otp_expired') || haystack.includes('flow_state')) {
    return 'expired';
  }
  return 'failed';
}

function sendDiagnostic(correlationId: string, event: string, payload?: Record<string, unknown>) {
  // Post sanitized diagnostic events to server — NEVER include tokens, codes, or secrets
  void fetch('/api/auth/oauth-diagnostic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      correlationId,
      event,
      ...payload,
    }),
  }).catch(() => undefined);
}

export function GoogleAuthCallbackClient({ correlationId }: { correlationId: string }) {
  const [state, setState] = useState<CallbackState>('connecting');
  const [errorKind, setErrorKind] = useState<ErrorKind>('failed');
  const [appLink, setAppLink] = useState('cardnest://');
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    let openTimer: number | undefined;
    let timeoutDiagnosticTimer: number | undefined;

    async function processCallback() {
      sendDiagnostic(correlationId, 'callback_loaded');

      // 1. Extract params BEFORE clearing browser location history
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/u, ''));

      const suppliedError = search.get('error') ?? hash.get('error');
      const suppliedErrorCode = search.get('error_code') ?? hash.get('error_code');
      const suppliedDescription = search.get('error_description') ?? hash.get('error_description');

      const accessToken = hash.get('access_token') ?? search.get('access_token');
      const refreshToken = hash.get('refresh_token') ?? search.get('refresh_token');
      const code = search.get('code') ?? hash.get('code');

      sendDiagnostic(correlationId, 'parameters_inspected', {
        codePresent: Boolean(code),
        hashTokensPresent: Boolean(accessToken && refreshToken),
        searchTokensPresent: Boolean(search.get('access_token') && search.get('refresh_token')),
        errorPresent: Boolean(suppliedError || suppliedErrorCode),
      });

      // 2. Clear sensitive tokens from browser URL bar for security
      if (window.location.search || window.location.hash) {
        try {
          window.history.replaceState({}, '', '/gauth/callback');
        } catch {
          // Ignore replaceState failures in constrained webviews
        }
      }

      await Promise.resolve();

      // 3. Handle OAuth Provider Error
      if (suppliedError || suppliedErrorCode) {
        const kind = classifyError(suppliedError, suppliedErrorCode, suppliedDescription);
        sendDiagnostic(correlationId, 'callback_error', { errorKind: kind, errorPresent: true });
        setErrorKind(kind);
        setState('error');
        return;
      }

      // 4. Construct Mobile Deep Link
      let nextAppLink: string | null = null;
      let linkFormat: 'hash_tokens' | 'code_relay' | null = null;

      if (accessToken && refreshToken) {
        const fragment = new URLSearchParams({
          access_token: accessToken,
          refresh_token: refreshToken,
          type: 'oauth',
        });
        nextAppLink = `cardnest://auth/callback#${fragment.toString()}`;
        linkFormat = 'hash_tokens';
      } else if (code) {
        const query = new URLSearchParams({ code, flow: 'oauth' });
        nextAppLink = `cardnest://auth/callback?${query.toString()}`;
        linkFormat = 'code_relay';
      }

      // 5. Handle Missing Parameters Error
      if (!nextAppLink) {
        sendDiagnostic(correlationId, 'callback_error', { errorKind: 'invalid', errorPresent: false });
        setErrorKind('invalid');
        setState('error');
        return;
      }

      sendDiagnostic(correlationId, 'deep_link_constructed', {
        format: linkFormat,
        codePresent: Boolean(code),
        hashTokensPresent: Boolean(accessToken && refreshToken),
      });

      const appLinkToOpen = nextAppLink;
      setAppLink(appLinkToOpen);
      setState('success');

      // 6. Automatically trigger app launch via deep link
      openTimer = window.setTimeout(() => {
        sendDiagnostic(correlationId, 'deep_link_attempted', { format: linkFormat });
        window.location.assign(appLinkToOpen);
      }, 300);

      // 7. Timeout check if browser stays visible for > 2.5 seconds
      timeoutDiagnosticTimer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          sendDiagnostic(correlationId, 'deep_link_timeout', { format: linkFormat });
        }
      }, 2500);
    }

    void processCallback();

    return () => {
      if (openTimer) window.clearTimeout(openTimer);
      if (timeoutDiagnosticTimer) window.clearTimeout(timeoutDiagnosticTimer);
    };
  }, [correlationId]);

  const isError = state === 'error';
  const copy = errorCopy[errorKind];

  return (
    <section className="container grid min-h-[60vh] place-items-center px-4 py-8 sm:min-h-[68vh] sm:py-16">
      <div className="card-shadow w-full max-w-xl rounded-[2rem] border border-[#dbe8eb] bg-white p-6 text-center sm:p-10 md:p-12">
        <div
          aria-hidden
          className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl font-black ${
            isError ? 'bg-[#fce4e8] text-[#c73a4a]' : 'bg-[#dff8fc] text-[#067a90]'
          }`}>
          {state === 'connecting' ? '…' : isError ? '!' : '✓'}
        </div>
        <p className="mt-6 text-xs font-bold tracking-[0.12em] text-[#079cb8] sm:mt-7 sm:text-sm">GOOGLE SIGN-IN</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] sm:mt-3 sm:text-3xl">
          {isError ? copy.title : state === 'connecting' ? 'Finishing your sign-in' : 'You’re signed in to Card Nest'}
        </h1>
        <p aria-live="polite" className="mt-4 text-base leading-7 text-[#60767c] sm:mt-5">
          {isError
            ? copy.body
            : state === 'connecting'
              ? 'One moment while we secure your Card Nest session…'
              : 'Return to the Card Nest app to continue. If the app didn’t open automatically, tap Open Card Nest below.'}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-center">
          {state === 'success' ? (
            <a
              className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl bg-[#079cb8] px-6 font-bold text-white transition hover:bg-[#067a90] active:scale-98"
              href={appLink}
              onClick={() => sendDiagnostic(correlationId, 'deep_link_manual_tap')}>
              Open Card Nest
            </a>
          ) : null}
          <Link
            className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl border border-[#bfd5da] px-6 font-bold text-[#334a50] transition hover:border-[#0CC0DF] hover:text-[#067a90]"
            href="/">
            Return home
          </Link>
        </div>
        {state === 'success' ? (
          <p className="mt-6 text-xs leading-6 text-[#8aa0a6] sm:text-sm">
            On this device without the app? Install Card Nest on your phone, then sign in with the same Google account —
            your library follows you.
          </p>
        ) : null}
      </div>
    </section>
  );
}
