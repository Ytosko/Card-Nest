import { describe, expect, it } from 'vitest';

import {
  safeAuthMessage,
  safeWebAuthNext,
  webAuthErrorTarget,
  webAuthSuccessTarget,
} from '../../../web/lib/auth-callback';

describe('web authentication callback routing', () => {
  it('accepts only first-party Card Nest app destinations', () => {
    expect(safeWebAuthNext('/app')).toBe('/app');
    expect(safeWebAuthNext('/app/settings/profile?saved=true')).toBe('/app/settings/profile?saved=true');
    expect(safeWebAuthNext('https://attacker.example/app')).toBeNull();
    expect(safeWebAuthNext('//attacker.example/app')).toBeNull();
    expect(safeWebAuthNext('/privacy')).toBeNull();
  });

  it('routes a normal web OAuth result to the requested app destination', () => {
    const url = new URL('https://cardnest.ytosko.dev/auth/callback?next=%2Fapp');
    expect(webAuthSuccessTarget(url, 'signin')).toBe('/app');
  });

  it('routes recovery and valid PIN reauthentication intents in the correct order', () => {
    const recovery = new URL('https://cardnest.ytosko.dev/auth/callback?next=%2Fapp');
    expect(webAuthSuccessTarget(recovery, 'recovery')).toBe('/auth/reset-password');

    const nonce = 'a'.repeat(48);
    const pinReset = new URL(`https://cardnest.ytosko.dev/auth/callback?pin_reset_nonce=${nonce}`);
    expect(webAuthSuccessTarget(pinReset, 'signin')).toBe(`/app/reset-pin?nonce=${nonce}`);
  });

  it('sanitizes callback errors and returns them to the branded login flow', () => {
    expect(safeAuthMessage('Denied\r\nInjected')).toBe('Denied Injected');
    expect(webAuthErrorTarget('Google sign-in was cancelled.', 'signin')).toBe(
      '/auth?mode=signin&message=Google+sign-in+was+cancelled.',
    );
  });
});
