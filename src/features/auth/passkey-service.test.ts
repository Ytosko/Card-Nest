import { Platform } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import {
  deletePasskey,
  isPasskeySupported,
  listUserPasskeys,
  registerPasskey,
  renamePasskey,
  setNativePasskeysModule,
  signInWithPasskey,
} from './passkey-service';

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
  it('gracefully reports unsupported when native module is missing (Expo Go)', () => {
    Platform.OS = 'android';
    setNativePasskeysModule(null);
    expect(isPasskeySupported()).toBe(false);
  });

  it('detects passkey support when native module is present', () => {
    Platform.OS = 'android';
    setNativePasskeysModule({
      isSupported: () => true,
      create: vi.fn(() => Promise.resolve({ id: 'mock-cred' })),
      get: vi.fn(() => Promise.resolve({ id: 'mock-cred' })),
    });
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

  it('registers passkey on native platform when supported', async () => {
    Platform.OS = 'android';
    setNativePasskeysModule({
      isSupported: () => true,
      create: vi.fn(() => Promise.resolve({ id: 'mock-cred' })),
      get: vi.fn(() => Promise.resolve({ id: 'mock-cred' })),
    });
    const res = await registerPasskey('My Fingerprint');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.name).toBe('My Fingerprint');
    }
  });

  it('signs in with passkey on native platform when supported', async () => {
    Platform.OS = 'android';
    setNativePasskeysModule({
      isSupported: () => true,
      create: vi.fn(() => Promise.resolve({ id: 'mock-cred' })),
      get: vi.fn(() => Promise.resolve({ id: 'mock-cred' })),
    });
    const res = await signInWithPasskey();
    expect(res.success).toBe(true);
  });

  it('handles user cancellation gracefully', async () => {
    Platform.OS = 'android';
    setNativePasskeysModule({
      isSupported: () => true,
      create: vi.fn(() => Promise.reject(new Error('User cancelled the operation.'))),
      get: vi.fn(() => Promise.reject(new Error('User cancelled the operation.'))),
    });
    const res = await registerPasskey('My Fingerprint');
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.isCancelled).toBe(true);
      expect(res.error).toBe('Passkey registration was cancelled.');
    }
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
