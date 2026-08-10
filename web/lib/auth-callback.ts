import type { EmailOtpType } from '@supabase/supabase-js';

export const allowedEmailOtpTypes = new Set<EmailOtpType>([
  'email',
  'email_change',
  'invite',
  'magiclink',
  'recovery',
  'signup',
]);

const pinResetNoncePattern = /^[A-Za-z0-9_-]{40,64}$/u;

export function safeAuthMessage(value: string | null) {
  return value?.replace(/[\r\n]+/gu, ' ').trim().slice(0, 240) || null;
}

export function safeWebAuthNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;

  try {
    const candidate = new URL(value, 'https://cardnest.ytosko.dev');
    if (candidate.origin !== 'https://cardnest.ytosko.dev') return null;
    if (candidate.pathname !== '/app' && !candidate.pathname.startsWith('/app/')) return null;
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return null;
  }
}

export function webAuthSuccessTarget(url: URL, flowType: string) {
  if (flowType === 'recovery') return '/auth/reset-password';

  const pinResetNonce = url.searchParams.get('pin_reset_nonce');
  if (pinResetNonce && pinResetNoncePattern.test(pinResetNonce)) {
    return `/app/reset-pin?nonce=${encodeURIComponent(pinResetNonce)}`;
  }

  return safeWebAuthNext(url.searchParams.get('next')) ?? '/app';
}

export function webAuthErrorTarget(message: string, flowType: string) {
  const target = flowType === 'recovery' ? '/auth/forgot' : '/auth';
  const params = new URLSearchParams();
  if (target === '/auth') params.set('mode', 'signin');
  params.set('message', message.slice(0, 240));
  return `${target}?${params.toString()}`;
}
