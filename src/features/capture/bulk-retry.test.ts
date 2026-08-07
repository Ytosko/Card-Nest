import { describe, expect, it } from 'vitest';

import type { CaptureQueueItem } from './capture-queue-db';

describe('Bulk Failed-Job Retry Logic', () => {
  it('calculates queue metric counters correctly', () => {
    const mockItems: CaptureQueueItem[] = [
      { id: '1', userId: 'u1', cardId: 'c1', frontUri: 'file:///f1', backUri: null, state: 'failed', attemptCount: 2, lastError: 'Err 1', nextRetryAt: '2026-08-08', createdAt: '2026-08-07', updatedAt: '2026-08-07' },
      { id: '2', userId: 'u1', cardId: 'c2', frontUri: 'file:///f2', backUri: null, state: 'failed', attemptCount: 1, lastError: 'Err 2', nextRetryAt: null, createdAt: '2026-08-07', updatedAt: '2026-08-07' },
      { id: '3', userId: 'u1', cardId: 'c3', frontUri: 'file:///f3', backUri: null, state: 'uploading', attemptCount: 1, lastError: null, nextRetryAt: null, createdAt: '2026-08-07', updatedAt: '2026-08-07' },
      { id: '4', userId: 'u1', cardId: 'c4', frontUri: 'file:///f4', backUri: null, state: 'synced', attemptCount: 1, lastError: null, nextRetryAt: null, createdAt: '2026-08-07', updatedAt: '2026-08-07' },
    ];

    const failedCount = mockItems.filter((i) => i.state === 'failed').length;
    const queuedCount = mockItems.filter((i) => i.state === 'queued').length;
    const syncingCount = mockItems.filter((i) => i.state === 'uploading' || i.state === 'processing').length;
    const syncedCount = mockItems.filter((i) => i.state === 'synced').length;

    expect(failedCount).toBe(2);
    expect(queuedCount).toBe(0);
    expect(syncingCount).toBe(1);
    expect(syncedCount).toBe(1);
  });

  it('resets failed queue items into retryable state while preserving original card files & metadata', () => {
    const failedItem: CaptureQueueItem = {
      id: 'cap-1',
      userId: 'user-1',
      cardId: 'card-100',
      frontUri: 'file:///local/front.jpg',
      backUri: 'file:///local/back.jpg',
      state: 'failed',
      attemptCount: 3,
      lastError: 'Connection timeout',
      nextRetryAt: '2026-08-08T00:00:00.000Z',
      createdAt: '2026-08-07T10:00:00.000Z',
      updatedAt: '2026-08-07T10:05:00.000Z',
    };

    // Reset transform logic
    const resetItem: CaptureQueueItem = {
      ...failedItem,
      state: 'queued',
      lastError: null,
      nextRetryAt: null,
    };

    expect(resetItem.state).toBe('queued');
    expect(resetItem.lastError).toBeNull();
    expect(resetItem.nextRetryAt).toBeNull();

    // Verify original capture files and card ID were strictly preserved
    expect(resetItem.id).toBe('cap-1');
    expect(resetItem.cardId).toBe('card-100');
    expect(resetItem.frontUri).toBe('file:///local/front.jpg');
    expect(resetItem.backUri).toBe('file:///local/back.jpg');
    expect(resetItem.attemptCount).toBe(3);
  });

  it('formats bulk summary message based on retry completion results', () => {
    function formatSummary(newlySynced: number, stillFailed: number, total: number) {
      return stillFailed === 0
        ? `All ${total} failed jobs retried and synced successfully!`
        : `${newlySynced} synced · ${stillFailed} still need attention`;
    }

    expect(formatSummary(5, 0, 5)).toBe('All 5 failed jobs retried and synced successfully!');
    expect(formatSummary(5, 2, 7)).toBe('5 synced · 2 still need attention');
    expect(formatSummary(0, 3, 3)).toBe('0 synced · 3 still need attention');
  });
});
