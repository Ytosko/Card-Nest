import { describe, expect, it } from 'vitest';

import { parseAuthLink } from './auth-link';

describe('Supabase auth callback parsing', () => {
  it('parses implicit recovery tokens from a fragment', () => {
    expect(parseAuthLink('cardnest://auth/callback#access_token=access&refresh_token=refresh&type=recovery')).toEqual({
      kind: 'session',
      accessToken: 'access',
      refreshToken: 'refresh',
      flowType: 'recovery',
    });
  });

  it('parses a PKCE authorization code', () => {
    expect(parseAuthLink('cardnest://auth/callback?flow=recovery&code=secure-code')).toEqual({
      kind: 'code',
      code: 'secure-code',
      flowType: 'recovery',
    });
  });

  it('surfaces expired-link errors', () => {
    expect(parseAuthLink('cardnest://auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+expired')).toEqual({
      kind: 'error',
      code: 'otp_expired',
      message: 'Email link expired',
    });
  });

  it('rejects incomplete links', () => {
    expect(parseAuthLink('cardnest://auth/callback')).toEqual({ kind: 'invalid' });
    expect(parseAuthLink('not a url')).toEqual({ kind: 'invalid' });
  });
});
