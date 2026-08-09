import { Platform } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import {
  deletePasskey,
  getPasskeyAvailability,
  isPasskeySupported,
  listUserPasskeys,
  registerPasskey,
  renamePasskey,
  setNativePasskeysModule,
  signInWithPasskey,
} from './passkey-service';

<<<<<<< HEAD
vi.mock('expo-constants', () => ({
  default: {
    appOwnership: null,
    executionEnvironment: 'standalone',
  },
  ExecutionEnvironment: {
    StoreClient: 'storeClient',
  },
}));

vi.mock('@/src/lib/supabase/auth-storage', () => ({
  authStorage: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

=======
>>>>>>> 5e7a263056d44fb2e9db9b2b11f445ef343b02db
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
<<<<<<< HEAD
  it('gracefully reports PASSKEY_NATIVE_MODULE_MISSING when native module is missing', () => {
    Platform.OS = 'android';
    setNativePasskeysModule(null);
    const availability = getPasskeyAvailability();
    expect(availability.isSupported).toBe(false);
    expect(availability.code).toBe('PASSKEY_NATIVE_MODULE_MISSING');
=======
  it('gracefully reports unsupported when native module is missing (Expo Go)', () => {
    Platform.OS = 'android';
    setNativePasskeysModule(null);
>>>>>>> 5e7a263056d44fb2e9db9b2b11f445ef343b02db
    expect(isPasskeySupported()).toBe(false);
  });

  it('detects passkey support when native module is present', () => {
    Platform.OS = 'android';
    setNativePasskeysModule({
      isSupported: () => true,
      create: vi.fn(() => Promise.resolve({ id: 'mock-cred' })),
      get: vi.fn(() => Promise.resolve({ id: 'mock-cred' })),
    });
<<<<<<< HEAD
    const availability = getPasskeyAvailability();
    expect(availability.isSupported).toBe(true);
=======
>>>>>>> 5e7a263056d44fb2e9db9b2b11f445ef343b02db
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

<<<<<<< HEAD
  it('classifies PASSKEY_NOT_REGISTERED when no credential exists on device', async () => {
    Platform.OS = 'android';
    setNativePasskeysModule({
      isSupported: () => true,
      create: vi.fn(() => Promise.resolve({ id: 'mock-cred' })),
      get: vi.fn(() => Promise.reject({ name: 'NoCredentialsException', message: 'No credential found for this RP' })),
    });
    const res = await signInWithPasskey();
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe('PASSKEY_NOT_REGISTERED');
      expect(res.error).toContain('No passkey found for this account');
    }
  });

  it('handles user cancellation gracefully with PASSKEY_CANCELLED', async () => {
=======
  it('handles user cancellation gracefully', async () => {
>>>>>>> 5e7a263056d44fb2e9db9b2b11f445ef343b02db
    Platform.OS = 'android';
    setNativePasskeysModule({
      isSupported: () => true,
      create: vi.fn(() => Promise.reject(new Error('User cancelled the operation.'))),
      get: vi.fn(() => Promise.reject(new Error('User cancelled the operation.'))),
    });
    const res = await registerPasskey('My Fingerprint');
    expect(res.success).toBe(false);
    if (!res.success) {
<<<<<<< HEAD
      expect(res.code).toBe('PASSKEY_CANCELLED');
=======
>>>>>>> 5e7a263056d44fb2e9db9b2b11f445ef343b02db
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

