import type { EmailOtpType } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import {
  allowedEmailOtpTypes,
  safeAuthMessage,
  webAuthErrorTarget,
  webAuthSuccessTarget,
} from '@/lib/auth-callback';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function redirectFromCallback(requestUrl: URL, target: string) {
  const origin = process.env.NODE_ENV === 'production'
    ? 'https://cardnest.ytosko.dev'
    : requestUrl.origin;
  const response = NextResponse.redirect(new URL(target, origin), 303);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const correlationId = `web_${randomUUID().replace(/-/gu, '').slice(0, 10)}`;
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const rawType = url.searchParams.get('type');
  const flowType = rawType ?? 'signin';
  const suppliedError = safeAuthMessage(
    url.searchParams.get('error_description') ?? url.searchParams.get('error'),
  );

  console.info(
    `[Web auth callback] correlationId=${correlationId} stage=received codePresent=${Boolean(code)} tokenHashPresent=${Boolean(tokenHash)} errorPresent=${Boolean(suppliedError)} flowType=${allowedEmailOtpTypes.has(flowType as EmailOtpType) ? flowType : 'signin'}`,
  );

  if (suppliedError) {
    console.info(`[Web auth callback] correlationId=${correlationId} stage=provider_error`);
    return redirectFromCallback(url, webAuthErrorTarget(suppliedError, flowType));
  }

  const supabase = await createServerSupabaseClient({ requireCookieWrites: true });

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code).catch(() => ({
      data: { session: null },
      error: new Error('Code exchange failed.'),
    }));
    if (error || !data.session) {
      console.info(`[Web auth callback] correlationId=${correlationId} stage=code_exchange_failed`);
      return redirectFromCallback(
        url,
        webAuthErrorTarget('This sign-in link expired or has already been used. Start Google sign-in again.', flowType),
      );
    }
  } else if (tokenHash && rawType && allowedEmailOtpTypes.has(rawType as EmailOtpType)) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: rawType as EmailOtpType,
    }).catch(() => ({ data: { session: null }, error: new Error('Email verification failed.') }));
    if (error) {
      console.info(`[Web auth callback] correlationId=${correlationId} stage=email_verification_failed`);
      return redirectFromCallback(
        url,
        webAuthErrorTarget('This secure email link expired or has already been used. Request a fresh link and try again.', flowType),
      );
    }
    if (!data.session && rawType === 'email_change') {
      const { data: current } = await supabase.auth.getUser();
      if (!current.user) {
        console.info(`[Web auth callback] correlationId=${correlationId} stage=email_change_confirmed_login_required`);
        return redirectFromCallback(
          url,
          webAuthErrorTarget('Email address confirmed. Log in again to continue.', 'signin'),
        );
      }
    } else if (!data.session) {
      console.info(`[Web auth callback] correlationId=${correlationId} stage=email_session_missing`);
      return redirectFromCallback(
        url,
        webAuthErrorTarget('This secure email link could not establish a session. Request a fresh link and try again.', flowType),
      );
    }
  } else {
    console.info(`[Web auth callback] correlationId=${correlationId} stage=incomplete_request`);
    return redirectFromCallback(
      url,
      webAuthErrorTarget('This secure link is incomplete. Start the sign-in or recovery flow again.', flowType),
    );
  }

  const target = webAuthSuccessTarget(url, flowType);
  console.info(`[Web auth callback] correlationId=${correlationId} stage=session_established target=${target.split('?')[0]}`);
  return redirectFromCallback(url, target);
}
