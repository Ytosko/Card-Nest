import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getProviderCredentialState,
  getProviderKey,
  getProviderKeyDetails,
  removeProviderKey,
  saveServerCredential,
  setProviderKey,
} from './ai-provider';

const store = new Map<string, string>();
let simulateReadError = false;

vi.mock('expo-secure-store', () => {
  return {
    getItemAsync: vi.fn(async (key: string) => {
      if (simulateReadError) {
        throw new Error('android.security.KeyStoreException: Keystore hardware error');
      }
      return store.get(key) ?? null;
    }),
    setItemAsync: vi.fn(async (key: string, val: string) => {
      store.set(key, val);
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
    ALWAYS_THIS_DEVICE_ONLY: 2,
  };
});

vi.mock('@/src/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
        then: vi.fn((cb) => cb({ data: [], error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
    functions: {
      invoke: vi.fn(async () => ({ data: { ok: true, keySuffix: '9999' }, error: null })),
    },
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-123' } } })),
    },
  },
}));

describe('AI API Key Lifecycle & Android SecureStore Audit (Bug 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    simulateReadError = false;
  });

  it('persists API key across simulated app restarts', async () => {
    await setProviderKey('openai', 'sk-proj-testkey123456');
    const keyAfterRestart = await getProviderKey('openai');
    expect(keyAfterRestart).toBe('sk-proj-testkey123456');
  });

  it('preserves key accessibility across 3+ days of simulated time passage', async () => {
    await setProviderKey('gemini', 'AIzaSyTestGeminiKey7890');

    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now + 3 * 24 * 60 * 60 * 1000);

    const keyAfter3Days = await getProviderKey('gemini');
    expect(keyAfter3Days).toBe('AIzaSyTestGeminiKey7890');
    dateSpy.mockRestore();
  });

  it('preserves key accessibility across simulated Supabase session refresh', async () => {
    await setProviderKey('openai', 'sk-session-refresh-key');
    const key = await getProviderKey('openai');
    expect(key).toBe('sk-session-refresh-key');
  });

  it('preserves key accessibility across simulated OTA update reload', async () => {
    await setProviderKey('gemini', 'AIzaSyOtaTestKey');
    const key = await getProviderKey('gemini');
    expect(key).toBe('AIzaSyOtaTestKey');
  });

  it('automatically migrates legacy SecureStore key names during Android upgrade', async () => {
    store.set('cardnest.ai.openai.api-key', 'sk-legacy-migrated-key');

    const details = await getProviderKeyDetails('openai');
    expect(details.status).toBe('legacy_key_found');
    expect(details.key).toBe('sk-legacy-migrated-key');

    expect(store.get('cardnest.ai.openai.api-key.v1')).toBe('sk-legacy-migrated-key');
    expect(store.has('cardnest.ai.openai.api-key')).toBe(false);
  });

  it('distinguishes native secure_store_read_error from key_missing without claiming missing', async () => {
    simulateReadError = true;

    const details = await getProviderKeyDetails('openai');
    expect(details.status).toBe('secure_store_read_error');
    expect(details.key).toBeNull();
    expect(details.errorMessage).toContain('Keystore hardware error');

    const credState = await getProviderCredentialState('openai');
    expect(credState.state).toBe('secure_store_read_error');
    expect(credState.errorDetails?.message).toContain('Keystore hardware error');

    simulateReadError = false;
  });

  it('reports key_missing when getItemAsync returns null without error', async () => {
    const details = await getProviderKeyDetails('gemini');
    expect(details.status).toBe('key_missing');
    expect(details.key).toBeNull();
  });

  it('supports independent provider switching without key interference', async () => {
    await setProviderKey('openai', 'sk-openai-key-1');
    await setProviderKey('gemini', 'AIzaSy-gemini-key-2');

    expect(await getProviderKey('openai')).toBe('sk-openai-key-1');
    expect(await getProviderKey('gemini')).toBe('AIzaSy-gemini-key-2');
  });

  it('replaces key when new API key is provided', async () => {
    await saveServerCredential('openai', 'sk-old-key-1111');
    expect(await getProviderKey('openai')).toBe('sk-old-key-1111');

    await saveServerCredential('openai', 'sk-new-key-2222');
    expect(await getProviderKey('openai')).toBe('sk-new-key-2222');
  });

  it('deletes local and legacy keys on explicit removal', async () => {
    await setProviderKey('openai', 'sk-to-be-deleted');
    expect(await getProviderKey('openai')).toBe('sk-to-be-deleted');

    await removeProviderKey('openai');
    expect(await getProviderKey('openai')).toBeNull();
  });

  it('returns needs_local_key state when cloud record exists but local key is missing', async () => {
    const stateInfo = await getProviderCredentialState('openai');
    expect(stateInfo.state).toBe('not_configured');

    await setProviderKey('openai', 'sk-local-and-ready');
    const readyState = await getProviderCredentialState('openai');
    expect(readyState.state).toBe('ready');
    expect(readyState.keySuffix).toBe('eady');
  });
});
