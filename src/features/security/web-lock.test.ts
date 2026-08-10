import { describe, expect, it, vi } from 'vitest';

import { createWebLockConfig, timeoutMilliseconds, verifyWebPin, webLockStorageKey } from '../../../web/lib/web-lock';

describe('browser-specific web lock', () => {
  it('uses a namespaced per-user storage key', () => {
    expect(webLockStorageKey('user-123')).toBe('cardnest.web-lock.v1.user-123');
  });

  it('accepts only an exact six-digit PIN', async () => {
    await expect(createWebLockConfig('12345')).rejects.toThrow('exactly six digits');
    await expect(createWebLockConfig('12345a')).rejects.toThrow('exactly six digits');
  });

  it('derives a salted verifier and verifies without storing the PIN', async () => {
    const config = await createWebLockConfig('246810', '1h');
    expect(config.verifier).not.toContain('246810');
    expect(config.salt.length).toBeGreaterThan(10);
    await expect(verifyWebPin('246810', config)).resolves.toMatchObject({ ok: true, config: { failedAttempts: 0 } });
  });

  it('increments failures and enforces retry delay after repeated failures', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-10T00:00:00Z'));
    let config = await createWebLockConfig('246810');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await verifyWebPin('000000', config); config = result.config;
    }
    expect(config.failedAttempts).toBe(3);
    expect(config.lockedUntil).toBe(Date.now() + 5_000);
    await expect(verifyWebPin('246810', config)).resolves.toMatchObject({ ok: false, waitSeconds: 5 });
    vi.useRealTimers();
  });

  it('maps every supported web unlock setting', () => {
    expect(timeoutMilliseconds('restart')).toBe(Number.POSITIVE_INFINITY);
    expect(timeoutMilliseconds('1h')).toBe(60 * 60 * 1000);
    expect(timeoutMilliseconds('6h')).toBe(6 * 60 * 60 * 1000);
    expect(timeoutMilliseconds('12h')).toBe(12 * 60 * 60 * 1000);
  });
});
