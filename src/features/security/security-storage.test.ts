import { describe, expect, it, vi } from 'vitest';

import {
  clearDeviceLock,
  getAutoLockTimeout,
  getUnlockMethod,
  savePin,
  setAutoLockTimeout,
  setUnlockMethod,
  verifyPin,
} from './security-storage';

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(() => Promise.resolve(true)),
  isEnrolledAsync: vi.fn(() => Promise.resolve(true)),
  authenticateAsync: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]))),
  digestStringAsync: vi.fn((algo, str) => Promise.resolve(`hash_${str}`)),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

vi.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: vi.fn((key: string) => Promise.resolve(store[key] || null)),
    setItemAsync: vi.fn((key: string, val: string) => {
      store[key] = val;
      return Promise.resolve();
    }),
    deleteItemAsync: vi.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
  };
});

describe('Security Storage & Crypto Verifier', () => {
  it('throws error if PIN is not a 6-digit string', async () => {
    await expect(savePin('12345')).rejects.toThrow('Card Nest PIN must be a 6-digit number.');
    await expect(savePin('abcd12')).rejects.toThrow('Card Nest PIN must be a 6-digit number.');
  });

  it('saves PIN, derives verifier, and verifies correct PIN', async () => {
    await savePin('123456');
    const method = await getUnlockMethod();
    expect(method).toBe('pin');

    const result = await verifyPin('123456');
    expect(result.success).toBe(true);
  });

  it('rejects incorrect PIN and calculates attempt lockouts', async () => {
    await clearDeviceLock();
    await savePin('654321');

    const result1 = await verifyPin('111111');
    expect(result1.success).toBe(false);
    expect(result1.attemptsRemaining).toBe(9);

    await verifyPin('111111');
    const result3 = await verifyPin('111111'); // 3rd failure
    expect(result3.success).toBe(false);
    expect(result3.lockoutSeconds).toBe(30);

    const immediateRetry = await verifyPin('654321');
    expect(immediateRetry.success).toBe(false);
    expect(immediateRetry.error).toContain('Too many failed attempts');
  });

  it('clears device lock completely', async () => {
    await setUnlockMethod('passkey');
    expect(await getUnlockMethod()).toBe('passkey');
    await clearDeviceLock();
    expect(await getUnlockMethod()).toBe(null);
  });

  it('manages auto-lock timeouts cleanly', async () => {
    expect(await getAutoLockTimeout()).toBe('1m');
    await setAutoLockTimeout('5m');
    expect(await getAutoLockTimeout()).toBe('5m');
  });
});
