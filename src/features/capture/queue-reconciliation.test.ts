import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '@/src/lib/supabase/client';

import {
  insertQueueItem,
  listQueueItems,
  removeQueueItem,
  updateQueueItem,
} from './capture-queue-db.web';
import { reconcileQueueItems } from './capture-queue-provider';

vi.mock('expo', () => ({
  requireNativeModule: vi.fn(),
  EventEmitter: vi.fn(),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseSync: vi.fn(() => ({
    execSync: vi.fn(),
    runAsync: vi.fn(async () => ({})),
    getAllAsync: vi.fn(async () => []),
    getFirstAsync: vi.fn(async () => null),
  })),
  defaultDatabaseDirectory: 'file:///sqlite/',
}));

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(async () => ({ uri: 'file:///manipulated.jpg', width: 100, height: 100 })),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

vi.mock('expo-file-system', () => ({
  readAsStringAsync: vi.fn(async () => ''),
  deleteAsync: vi.fn(async () => undefined),
  makeDirectoryAsync: vi.fn(async () => undefined),
  documentDirectory: 'file:///documents/',
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid'),
}));

vi.mock('expo-network', () => ({
  useNetworkState: vi.fn(() => ({ isConnected: true })),
}));

vi.mock('@/src/features/auth/auth-provider', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-test-123' } })),
}));

vi.mock('@/src/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({ data: [], error: null })),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
        in: vi.fn(async () => ({ data: [], error: null })),
      })),
      upsert: vi.fn(async () => ({ data: { id: 'card-1' }, error: null })),
      update: vi.fn(async () => ({ data: null, error: null })),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
        list: vi.fn(async () => ({ data: [{ name: 'front.jpg', metadata: { size: 100 } }], error: null })),
      })),
    },
  },
}));

describe('Queue Reconciliation & Retry Race Protection (Bug 2)', () => {
  const userId = 'user-test-123';

  beforeEach(async () => {
    vi.clearAllMocks();
    const existing = await listQueueItems(userId);
    for (const item of existing) {
      await removeQueueItem(item.id);
    }
  });

  it('updates queue state to synced on successful first try', async () => {
    const captureId = 'cap-1';
    const cardId = 'card-1';
    await insertQueueItem({ id: captureId, userId, cardId, frontUri: 'file:///front.jpg', backUri: null });

    await updateQueueItem(captureId, 'synced', { attemptCount: 1, lastError: null, nextRetryAt: null });

    const items = await listQueueItems(userId);
    expect(items[0].state).toBe('synced');
    expect(items[0].lastError).toBeNull();
  });

  it('ignores stale failure write when queue job is already in terminal synced state', async () => {
    const captureId = 'cap-2';
    const cardId = 'card-2';
    await insertQueueItem({ id: captureId, userId, cardId, frontUri: 'file:///front.jpg', backUri: null });

    await updateQueueItem(captureId, 'synced', { attemptCount: 1, lastError: null, nextRetryAt: null });

    await updateQueueItem(captureId, 'failed', { attemptCount: 1, lastError: 'Late network error', nextRetryAt: null });

    const items = await listQueueItems(userId);
    expect(items[0].state).toBe('synced');
    expect(items[0].lastError).toBeNull();
  });

  it('automatically repairs stale failed queue item when contact record already exists in Supabase', async () => {
    const captureId = 'cap-3';
    const cardId = 'card-3';
    await insertQueueItem({ id: captureId, userId, cardId, frontUri: 'file:///front.jpg', backUri: null });

    await updateQueueItem(captureId, 'failed', { attemptCount: 1, lastError: 'Transient error', nextRetryAt: null });

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'cards') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  id: 'card-3',
                  status: 'ready',
                  display_name: 'Jane Doe',
                  primary_email: 'jane@example.com',
                  primary_phone: '+1234567890',
                  extraction_quality: { failed: false },
                },
              ],
              error: null,
            })),
          })),
        } as any;
      }
      if (table === 'processing_jobs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [{ card_id: 'card-3', status: 'synced' }],
                error: null,
              })),
            })),
            in: vi.fn(async () => ({
              data: [{ card_id: 'card-3', status: 'synced' }],
              error: null,
            })),
          })),
        } as any;
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({ data: [], error: null })),
          })),
          in: vi.fn(async () => ({ data: [], error: null })),
        })),
      } as any;
    });

    const reconciled = await reconcileQueueItems(userId);
    const item = reconciled.find((i) => i.id === captureId);

    expect(item?.state).toBe('synced');
    expect(item?.lastError).toBeNull();
  });

  it('repairs queue state to not_a_card when processing_jobs indicates rejection', async () => {
    const captureId = 'cap-4';
    const cardId = 'card-4';
    await insertQueueItem({ id: captureId, userId, cardId, frontUri: 'file:///scenery.jpg', backUri: null });

    await updateQueueItem(captureId, 'failed', { attemptCount: 1, lastError: 'Processing', nextRetryAt: null });

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'cards') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: [], error: null })),
          })),
        } as any;
      }
      if (table === 'processing_jobs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [{ card_id: 'card-4', status: 'not_a_card', last_error: 'Not a contact card' }],
                error: null,
              })),
            })),
          })),
        } as any;
      }
      return {} as any;
    });

    const reconciled = await reconcileQueueItems(userId);
    const item = reconciled.find((i) => i.id === captureId);

    expect(item?.state).toBe('not_a_card');
    expect(item?.lastError).toBe('Not a contact card');
  });

  it('prevents creation of duplicate contacts during reconciliation', async () => {
    const captureId = 'cap-5';
    const cardId = 'card-5';
    await insertQueueItem({ id: captureId, userId, cardId, frontUri: 'file:///front.jpg', backUri: null });

    const upsertSpy = vi.fn();
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'cards') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{ id: 'card-5', status: 'ready', display_name: 'Existing Contact', extraction_quality: { failed: false } }],
              error: null,
            })),
          })),
          upsert: upsertSpy,
        } as any;
      }
      if (table === 'processing_jobs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [{ card_id: 'card-5', status: 'synced' }],
                error: null,
              })),
            })),
            in: vi.fn(async () => ({
              data: [{ card_id: 'card-5', status: 'synced' }],
              error: null,
            })),
          })),
        } as any;
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({ data: [], error: null })),
          })),
          in: vi.fn(async () => ({ data: [], error: null })),
        })),
      } as any;
    });

    await reconcileQueueItems(userId);

    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('MUST NOT repair to synced when only intermediate card exists (status review/failed) without synced job', async () => {
    const captureId = 'cap-6';
    const cardId = 'card-6';
    await insertQueueItem({ id: captureId, userId, cardId, frontUri: 'file:///front.jpg', backUri: null });
    await updateQueueItem(captureId, 'failed', { attemptCount: 1, lastError: 'Interrupted', nextRetryAt: null });

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'cards') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  id: 'card-6',
                  status: 'review',
                  display_name: 'Unfinished Card',
                  extraction_quality: { failed: true },
                },
              ],
              error: null,
            })),
          })),
        } as any;
      }
      if (table === 'processing_jobs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [{ card_id: 'card-6', status: 'failed' }],
                error: null,
              })),
            })),
            in: vi.fn(async () => ({
              data: [{ card_id: 'card-6', status: 'failed' }],
              error: null,
            })),
          })),
        } as any;
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({ data: [], error: null })),
          })),
          in: vi.fn(async () => ({ data: [], error: null })),
        })),
      } as any;
    });

    const reconciled = await reconcileQueueItems(userId);
    const item = reconciled.find((i) => i.id === captureId);

    expect(item?.state).toBe('failed');
  });
});
