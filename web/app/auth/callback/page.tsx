'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type CallbackState = 'checking' | 'success' | 'error';

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>('checking');
  const [message, setMessage] = useState('Checking your secure Card Nest link…');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/u, ''));
      const error = search.get('error_description') ?? search.get('error') ?? hash.get('error_description') ?? hash.get('error');

      if (error) {
        setState('error');
        setMessage(error.replace(/\+/gu, ' '));
        return;
      }

      setState('success');
      setMessage('Your secure link was accepted. You can return to the Card Nest app.');
    }, 0);

    return () => window.clearTimeout(timeout);
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
          {state === 'error' ? 'This link could not be opened' : state === 'checking' ? 'Verifying your link' : 'You’re all set'}
        </h1>
        <p aria-live="polite" className="mt-5 leading-7 text-[#60767c]">{message}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl bg-[#079cb8] px-6 font-bold text-white hover:bg-[#067a90]" href="cardnest://auth/callback">
            Open Card Nest
          </a>
          <Link className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl border border-[#bfd5da] px-6 font-bold text-[#334a50] hover:border-[#0CC0DF]" href="/">
            Return home
          </Link>
        </div>
      </div>
    </section>
  );
}
