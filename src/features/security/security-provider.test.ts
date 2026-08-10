import { describe, expect, it, vi } from 'vitest';

import {
  getAutoLockTimeout,
  getUnlockMethod,
  isBiometricEnabled,
} from './security-storage';

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
});
