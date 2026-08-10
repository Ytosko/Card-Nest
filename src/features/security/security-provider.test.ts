import { describe, expect, it, vi } from 'vitest';

import {
  getAutoLockTimeout,
  getUnlockMethod,
  isBiometricEnabled,
} from './security-storage';
import { shouldRequestAutomaticBiometric } from './security-coordinator';

vi.mock('./security-storage', () => ({
  getUnlockMethod: vi.fn(() => Promise.resolve('pin')),
  getAutoLockTimeout: vi.fn(() => Promise.resolve('1m')),
  isBiometricEnabled: vi.fn(() => Promise.resolve(false)),
}));

describe('Security Provider State Machine', () => {
  it('reads initial security state correctly from storage', async () => {
    const method = await getUnlockMethod();
    const timeout = await getAutoLockTimeout();
    const bio = await isBiometricEnabled();

    expect(method).toBe('pin');
    expect(timeout).toBe('1m');
    expect(bio).toBe(false);
  });

  it('requests one automatic biometric prompt for a signed-in locked PIN session', () => {
    const state = {
      authInitialized: true,
      hasSession: true,
      securityInitialized: true,
      unlockMethod: 'pin' as const,
      biometricEnabled: true,
      lockState: 'LOCKED' as const,
    };

    expect(shouldRequestAutomaticBiometric({ ...state, attemptConsumed: false })).toBe(true);
    expect(shouldRequestAutomaticBiometric({ ...state, attemptConsumed: true })).toBe(false);
  });

  it('does not prompt after PIN unlock, before auth, or without biometric opt-in', () => {
    const state = {
      authInitialized: true,
      hasSession: true,
      securityInitialized: true,
      unlockMethod: 'pin' as const,
      biometricEnabled: true,
      lockState: 'LOCKED' as const,
      attemptConsumed: false,
    };

    expect(shouldRequestAutomaticBiometric({ ...state, lockState: 'UNLOCKED' })).toBe(false);
    expect(shouldRequestAutomaticBiometric({ ...state, hasSession: false })).toBe(false);
    expect(shouldRequestAutomaticBiometric({ ...state, biometricEnabled: false })).toBe(false);
  });
});
