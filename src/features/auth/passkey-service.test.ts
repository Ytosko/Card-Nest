import { Platform } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import {
  deletePasskey,
  isPasskeySupported,
  listUserPasskeys,
  registerPasskey,
  renamePasskey,
  signInWithPasskey,
} from './passkey-service';

vi.mock('react-native-passkeys', () => ({
  isSupported: vi.fn(() => true),
  create: vi.fn(() => Promise.resolve({ id: 'mock-cred-id', rawId: 'mock-raw-id' })),
  get: vi.fn(() => Promise.resolve({ id: 'mock-cred-id', rawId: 'mock-raw-id' })),
}));

vi.mock('@/src/lib/supabase/client', () => ({
  supabase: {
    auth: {
      registerPasskey: vi.fn(() => Promise.resolve({ data: { id: 'web-1' }, error: null })),
      signInWithPasskey: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      passkey: {
        list: vi.fn(() => Promise.resolve({ data: [{ id: 'pk-1', friendly_name: 'Work Phone', created_at: '2026-08-09T00:00:00Z' }], error: null })),
        startRegistration: vi.fn(() => Promise.resolve({ data: { challengeId: 'c1', publicKey: {} }, error: null })),
        verifyRegistration: vi.fn(() => Promise.resolve({ data: { id: 'native-1' }, error: null })),
        startAuthentication: vi.fn(() => Promise.resolve({ data: { challengeId: 'c2', publicKey: {} }, error: null })),
        verifyAuthentication: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        update: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        delete: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      },
    },
  },
}));

describe('Passkey Service', () => {
  it('detects passkey support correctly', () => {
    Platform.OS = 'android';
    expect(isPasskeySupported()).toBe(true);
  });

  it('lists user passkeys cleanly', async () => {
    const res = await listUserPasskeys();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe('Work Phone');
    }
  });

  it('registers passkey on native platform', async () => {
    Platform.OS = 'android';
    const res = await registerPasskey('My Fingerprint');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.name).toBe('My Fingerprint');
    }
  });

  it('signs in with passkey on native platform', async () => {
    Platform.OS = 'android';
    const res = await signInWithPasskey();
    expect(res.success).toBe(true);
  });

  it('renames a passkey', async () => {
    const res = await renamePasskey('pk-1', 'Personal Phone');
    expect(res.success).toBe(true);
  });

  it('deletes a passkey', async () => {
    const res = await deletePasskey('pk-1');
    expect(res.success).toBe(true);
  });
});
