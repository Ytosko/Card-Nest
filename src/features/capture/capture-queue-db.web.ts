export type CaptureQueueState = 'queued' | 'uploading' | 'processing' | 'synced' | 'failed';
export type CaptureQueueItem = {
  id: string;
  userId: string;
  cardId: string;
  frontUri: string;
  backUri: string | null;
  state: CaptureQueueState;
  attemptCount: number;
  lastError: string | null;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// In-memory web fallback store
const webQueue = new Map<string, CaptureQueueItem>();

export async function insertQueueItem(
  item: Omit<CaptureQueueItem, 'state' | 'attemptCount' | 'lastError' | 'nextRetryAt' | 'createdAt' | 'updatedAt'>
) {
  const now = new Date().toISOString();
  const queueItem: CaptureQueueItem = {
    ...item,
    state: 'queued',
    attemptCount: 0,
    lastError: null,
    nextRetryAt: null,
    createdAt: now,
    updatedAt: now,
  };
  webQueue.set(item.id, queueItem);
}

export async function listQueueItems(userId: string): Promise<CaptureQueueItem[]> {
  const items = Array.from(webQueue.values()).filter((i) => i.userId === userId);
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateQueueItem(
  id: string,
  state: CaptureQueueState,
  values?: { attemptCount?: number; lastError?: string | null; nextRetryAt?: string | null }
) {
  const item = webQueue.get(id);
  if (!item) return;
  const updated: CaptureQueueItem = {
    ...item,
    state,
    attemptCount: values?.attemptCount ?? item.attemptCount,
    lastError: values?.lastError !== undefined ? values.lastError : item.lastError,
    nextRetryAt: values?.nextRetryAt !== undefined ? values.nextRetryAt : item.nextRetryAt,
    updatedAt: new Date().toISOString(),
  };
  webQueue.set(id, updated);
}

export async function removeQueueItem(id: string) {
  webQueue.delete(id);
}
