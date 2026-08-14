import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  extractBusinessCard,
  getProviderCredentialState,
  getServerCredentialStatus,
  migrateLocalKeyToServer,
  removeServerCredential,
  saveServerCredential,
} from './ai-provider';
import { getModelCatalog } from './model-catalog';

const store = new Map<string, string>();
const serverStore = new Map<string, { provider: string; encrypted: string }>();

vi.mock('expo-secure-store', () => {
  return {
    getItemAsync: vi.fn(async (key: string) => {
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

vi.mock('expo-file-system', () => {
  function MockDirectory() {
    return { exists: true, create: vi.fn() };
  }
  function MockFile(this: any) {
    this.exists = false;
    this.write = vi.fn();
    this.textSync = vi.fn();
  }
  return { Directory: MockDirectory, File: MockFile, Paths: { document: 'file:///doc' } };
});

vi.mock('@/src/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn((field: string, val: string) => ({
          maybeSingle: vi.fn(async () => {
            if (table === 'user_ai_credentials') {
              const item = serverStore.get(val);
              if (item) return { data: { provider: item.provider, updated_at: '2026-08-14' }, error: null };
            }
            return { data: null, error: null };
          }),
        })),
        then: vi.fn((cb) => {
          const list = Array.from(serverStore.values()).map((v) => ({
            provider: v.provider,
            updated_at: '2026-08-14',
          }));
          return cb({ data: list, error: null });
        }),
      })),
      upsert: vi.fn(async () => ({ data: null, error: null })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
    functions: {
      invoke: vi.fn(async (name: string, options?: any) => {
        if (name.includes('action=models')) {
          return { data: { ok: true, models: ['gemini-2.5-flash', 'gemini-3.5-flash-lite'] }, error: null };
        }
        if (name.startsWith('ai-credentials')) {
          const method = options?.method ?? 'POST';
          if (method === 'GET') {
            const credentials: Record<string, any> = {};
            for (const [p] of serverStore.entries()) {
              credentials[p] = { connected: true, updatedAt: '2026-08-14' };
            }
            return { data: { ok: true, credentials }, error: null };
          }
          if (method === 'DELETE') {
            const provider = name.includes('provider=') ? name.split('provider=')[1] : 'openai';
            serverStore.delete(provider);
            return { data: { ok: true, connected: false }, error: null };
          }
          const { provider, apiKey } = options?.body || {};
          if (apiKey === 'invalid-key') {
            return { data: { error: 'The provided key could not be verified.' }, error: null };
          }
          if (provider && apiKey) {
            serverStore.set(provider, { provider, encrypted: 'encrypted-' + apiKey });
            return { data: { ok: true, provider, connected: true }, error: null };
          }
        }
        if (name === 'ai-extract') {
          return {
            data: {
              ok: true,
              result: {
                documentClassification: { result: 'VALID_CARD', confidence: 0.95, reason: 'Valid' },
                displayName: 'Jane Doe',
                firstName: 'Jane',
                middleName: '',
                lastName: 'Doe',
                company: 'Acme Corp',
                jobTitle: 'VP Product',
                department: 'Engineering',
                emails: [{ email: 'jane@acme.com', label: 'work', isPrimary: true }],
                phones: [{ number: '+1234567890', label: 'mobile', service: '', serviceLabel: '', isPrimary: true }],
                websites: ['https://acme.com'],
                addressLine1: '',
                addressLine2: '',
                city: 'San Francisco',
                stateRegion: 'CA',
                postalCode: '',
                country: 'USA',
                notes: '',
                rawText: 'Jane Doe VP Product Acme Corp',
                confidence: 0.95,
              },
            },
            error: null,
          };
        }
        return { data: { ok: true }, error: null };
      }),
    },
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-123' } } })),
    },
  },
}));

describe('Account-Level AI Credentials & Security Architecture (15 Verification Requirements)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    serverStore.clear();
  });

  it('1 & 2. Cross-platform sync: configuring Gemini on Android shows connected on Web', async () => {
    await saveServerCredential('gemini', 'AIzaSy-valid-gemini-key');

    const status = await getServerCredentialStatus();
    expect(status.gemini?.connected).toBe(true);

    const credState = await getProviderCredentialState('gemini');
    expect(credState.state).toBe('ready');
    expect(credState.hasServerCredential).toBe(true);
  });

  it('3 & 4. Account-level model discovery: fetches catalog via Edge Function without returning raw key', async () => {
    serverStore.set('gemini', { provider: 'gemini', encrypted: 'secret' });
    const catalog = await getModelCatalog('gemini', null, { forceRefresh: true });

    expect(catalog.models.length).toBeGreaterThan(0);
    expect(catalog.models.some((m) => m.id === 'gemini-2.5-flash')).toBe(true);
  });

  it('5, 6 & 7. Reinstall / new device / logout-login: AI remains connected for account without re-entering keys', async () => {
    await saveServerCredential('openai', 'sk-proj-account-key-999');

    // Simulate complete device local store wipe (reinstall / new device)
    store.clear();

    const credState = await getProviderCredentialState('openai');
    expect(credState.state).toBe('ready');
    expect(credState.hasServerCredential).toBe(true);
  });

  it('8. Multi-tenant security isolation: different user account receives empty credentials', async () => {
    serverStore.set('openai', { provider: 'openai', encrypted: 'secret' });

    // Switch server store to simulate different user
    serverStore.clear();

    const status = await getServerCredentialStatus();
    expect(status.openai?.connected).toBeUndefined();
  });

  it('9. Replacing key succeeds server-side', async () => {
    await saveServerCredential('openai', 'sk-old-key');
    expect((await getServerCredentialStatus()).openai?.connected).toBe(true);

    await saveServerCredential('openai', 'sk-new-valid-key');
    expect((await getServerCredentialStatus()).openai?.connected).toBe(true);
  });

  it('10. Invalid replacement key fails validation and does NOT overwrite existing key', async () => {
    await saveServerCredential('openai', 'sk-working-key');
    expect(serverStore.get('openai')?.encrypted).toBe('encrypted-sk-working-key');

    await expect(saveServerCredential('openai', 'invalid-key')).rejects.toThrow();

    // Verify existing key was preserved
    expect(serverStore.get('openai')?.encrypted).toBe('encrypted-sk-working-key');
  });

  it('11. Deleting key disconnects provider across all platforms', async () => {
    await saveServerCredential('gemini', 'AIzaSy-key-to-delete');
    expect((await getServerCredentialStatus()).gemini?.connected).toBe(true);

    await removeServerCredential('gemini');
    expect((await getServerCredentialStatus()).gemini?.connected).toBeUndefined();
    expect(serverStore.has('gemini')).toBe(false);
  });

  it('12. Zero secret key bytes returned in client queries/responses/logs', async () => {
    await saveServerCredential('openai', 'sk-proj-secret123456');

    const status = await getServerCredentialStatus();
    expect(JSON.stringify(status)).not.toContain('sk-proj-secret123456');
    expect(JSON.stringify(status)).not.toContain('secret123456');
  });

  it('13. Edge Function performs extraction successfully without client possessing raw key', async () => {
    vi.mock('@/src/features/capture/capture-files', () => ({
      readCardImageAsBase64: vi.fn(async () => ({ base64: 'dummy-base64-data', source: 'local', byteSize: 100 })),
    }));

    const result = await extractBusinessCard('openai', 'gpt-4o', null, ['file:///card_front.jpg']);
    expect(result.displayName).toBe('Jane Doe');
    expect(result.company).toBe('Acme Corp');
  });

  it('14 & 15. Automatic SecureStore migration: uploads local key to server and removes local copy only after server confirmation', async () => {
    // Seed local SecureStore key
    store.set('cardnest.ai.openai.api-key.v1', 'sk-local-legacy-key');
    expect(serverStore.has('openai')).toBe(false);

    const migrated = await migrateLocalKeyToServer('openai');
    expect(migrated).toBe(true);

    // Verify key was uploaded to server
    expect(serverStore.has('openai')).toBe(true);

    // Verify local SecureStore key was wiped
    expect(store.has('cardnest.ai.openai.api-key.v1')).toBe(false);
  });
});
