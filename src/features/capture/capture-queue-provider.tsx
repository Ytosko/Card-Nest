import { randomUUID } from 'expo-crypto';
import { useNetworkState } from 'expo-network';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/src/features/auth/auth-provider';
import { runConfiguredExtraction } from '@/src/features/ai/extraction-service';
import { getCardImageStoragePath } from '@/src/lib/supabase/storage-paths';
import { supabase } from '@/src/lib/supabase/client';

import { prepareCaptureFiles, readCardImageAsBase64, removePreparedCapture } from './capture-files';
import {
  insertQueueItem,
  listQueueItems,
  removeQueueItem,
  updateQueueItem,
  type CaptureQueueItem,
} from './capture-queue-db';

export type BulkRetryResult = {
  retriedTotal: number;
  newlySynced: number;
  stillFailed: number;
};

export type BulkProgressInfo = {
  current: number;
  total: number;
};

type CaptureQueueContextValue = {
  items: CaptureQueueItem[];
  failedCount: number;
  queuedCount: number;
  syncingCount: number;
  syncedCount: number;
  isProcessing: boolean;
  isRetryingBulk: boolean;
  bulkProgress: BulkProgressInfo | null;
  bulkSummaryNotice: string | null;
  enqueue: (frontUri: string, backUri?: string | null) => Promise<string>;
  refresh: () => Promise<void>;
  retry: (itemId?: string) => Promise<void>;
  retryAllFailed: () => Promise<BulkRetryResult>;
  dismissSynced: () => Promise<void>;
  clearSummaryNotice: () => void;
};

const CaptureQueueContext = createContext<CaptureQueueContextValue | null>(null);

export function CaptureQueueProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const network = useNetworkState();
  const [items, setItems] = useState<CaptureQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRetryingBulk, setIsRetryingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgressInfo | null>(null);
  const [bulkSummaryNotice, setBulkSummaryNotice] = useState<string | null>(null);

  const processingRef = useRef(false);

  const refresh = useCallback(async () => {
    setItems(user ? await listQueueItems(user.id) : []);
  }, [user]);

  const processQueueItem = useCallback(
    async (item: CaptureQueueItem, force = false): Promise<boolean> => {
      if (!user) return false;
      if (item.nextRetryAt && Date.parse(item.nextRetryAt) > Date.now() && !force) {
        return false;
      }

      const attempt = item.attemptCount + 1;
      await updateQueueItem(item.id, 'uploading', { attemptCount: attempt, lastError: null, nextRetryAt: null });
      await refresh();

      try {
        const frontPath = getCardImageStoragePath(user.id, item.cardId, 'front', 'jpg');
        const backPath = item.backUri ? getCardImageStoragePath(user.id, item.cardId, 'back', 'jpg') : null;

        const { error: cardError } = await supabase
          .from('cards')
          .upsert({
            id: item.cardId,
            user_id: user.id,
            status: 'uploading',
            display_name: 'New business card',
            source_front_image_path: frontPath,
            source_back_image_path: backPath,
          })
          .select('id')
          .single();
        if (cardError) throw cardError;

        const sides = [
          { side: 'front' as const, uri: item.frontUri, path: frontPath },
          ...(item.backUri && backPath ? [{ side: 'back' as const, uri: item.backUri, path: backPath }] : []),
        ];

        for (const side of sides) {
          const imageResult = await readCardImageAsBase64(side.uri, item.cardId, side.side, user.id);
          const buffer = Buffer.from(imageResult.base64, 'base64');

          const { error: uploadError } = await supabase.storage
            .from('card-images')
            .upload(side.path, buffer, { contentType: 'image/jpeg', upsert: true });
          if (uploadError) throw uploadError;

          const { error: metadataError } = await supabase.from('card_images').upsert(
            {
              user_id: user.id,
              card_id: item.cardId,
              side: side.side,
              storage_path: side.path,
              mime_type: 'image/jpeg',
              byte_size: imageResult.byteSize || buffer.length || null,
            },
            { onConflict: 'card_id,side' }
          );
          if (metadataError) throw metadataError;
        }

        await updateQueueItem(item.id, 'processing', { attemptCount: attempt, lastError: null, nextRetryAt: null });
        await refresh();

        const extracted = await runConfiguredExtraction(
          item.cardId,
          user.id,
          sides.map((captured) => captured.uri)
        );

        if (!extracted) {
          await updateQueueItem(item.id, 'failed', {
            attemptCount: attempt,
            lastError: 'Could not extract card details. Check AI settings or connection and retry.',
            nextRetryAt: null,
          });
          return false;
        } else {
          await updateQueueItem(item.id, 'synced', { attemptCount: attempt, lastError: null, nextRetryAt: null });
          return true;
        }
      } catch (catchedError) {
        const delayMinutes = Math.min(2 ** Math.min(attempt, 6), 60);
        const errMessage =
          catchedError instanceof Error ? catchedError.message : 'Upload paused. Card Nest will retry when connected.';
        await updateQueueItem(item.id, 'failed', {
          attemptCount: attempt,
          lastError: errMessage,
          nextRetryAt: new Date(Date.now() + delayMinutes * 60_000 + Math.random() * 15_000).toISOString(),
        });
        return false;
      }
    },
    [refresh, user]
  );

  const processQueue = useCallback(
    async (onlyId?: string, force = false) => {
      if (!user || network.isConnected === false || processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);
      try {
        const queue = await listQueueItems(user.id);
        for (const item of queue) {
          if (onlyId && item.id !== onlyId) continue;
          if (!['queued', 'failed', 'uploading', 'processing'].includes(item.state)) continue;

          await processQueueItem(item, force || Boolean(onlyId));
        }
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
        await refresh();
      }
    },
    [network.isConnected, processQueueItem, refresh, user]
  );

  const retrySingle = useCallback(
    async (itemId?: string) => {
      if (!user) return;
      if (itemId) {
        await updateQueueItem(itemId, 'queued', { lastError: null, nextRetryAt: null });
        await refresh();
        await processQueue(itemId, true);
      } else {
        await processQueue(undefined, true);
      }
    },
    [processQueue, refresh, user]
  );

  const retryAllFailed = useCallback(async (): Promise<BulkRetryResult> => {
    if (!user) return { retriedTotal: 0, newlySynced: 0, stillFailed: 0 };

    const currentItems = await listQueueItems(user.id);
    const failedItems = currentItems.filter((i) => i.state === 'failed');

    if (failedItems.length === 0) {
      return { retriedTotal: 0, newlySynced: 0, stillFailed: 0 };
    }

    setIsRetryingBulk(true);
    setBulkSummaryNotice(null);
    setBulkProgress({ current: 0, total: failedItems.length });

    // Step 1: Reset all failed items to queued in durable store, clearing transient errors & backoffs
    for (const item of failedItems) {
      await updateQueueItem(item.id, 'queued', { lastError: null, nextRetryAt: null });
    }
    await refresh();

    let newlySynced = 0;
    let stillFailed = 0;

    // Step 2: Process each reset item through normal state machine without creating duplicate jobs
    for (let index = 0; index < failedItems.length; index++) {
      const item = failedItems[index];
      setBulkProgress({ current: index + 1, total: failedItems.length });

      const updatedList = await listQueueItems(user.id);
      const target = updatedList.find((i) => i.id === item.id);
      if (target) {
        const success = await processQueueItem(target, true);
        if (success) {
          newlySynced++;
        } else {
          stillFailed++;
        }
      }
    }

    setIsRetryingBulk(false);
    setBulkProgress(null);
    await refresh();

    const resultSummary =
      stillFailed === 0
        ? `All ${failedItems.length} failed jobs retried and synced successfully!`
        : `${newlySynced} synced · ${stillFailed} still need attention`;

    setBulkSummaryNotice(resultSummary);

    return {
      retriedTotal: failedItems.length,
      newlySynced,
      stillFailed,
    };
  }, [processQueueItem, refresh, user]);

  const dismissSynced = useCallback(async () => {
    const synced = items.filter((item) => item.state === 'synced');
    await Promise.all(
      synced.map(async (item) => {
        removePreparedCapture(item.id);
        await removeQueueItem(item.id);
      })
    );
    await refresh();
  }, [items, refresh]);

  const clearSummaryNotice = useCallback(() => {
    setBulkSummaryNotice(null);
  }, []);

  const enqueue = useCallback(
    async (frontUri: string, backUri?: string | null) => {
      if (!user) throw new Error('Sign in before capturing a card.');
      const captureId = randomUUID();
      const cardId = randomUUID();
      const files = await prepareCaptureFiles(captureId, frontUri, backUri);
      try {
        await insertQueueItem({ id: captureId, userId: user.id, cardId, frontUri: files.frontUri, backUri: files.backUri });
      } catch (error) {
        removePreparedCapture(captureId);
        throw error;
      }
      await refresh();
      void processQueue();
      return cardId;
    },
    [processQueue, refresh, user]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (network.isConnected !== false) void processQueue();
  }, [network.isConnected, processQueue]);

  // Metric counters
  const failedCount = useMemo(() => items.filter((i) => i.state === 'failed').length, [items]);
  const queuedCount = useMemo(() => items.filter((i) => i.state === 'queued').length, [items]);
  const syncingCount = useMemo(
    () => items.filter((i) => i.state === 'uploading' || i.state === 'processing').length,
    [items]
  );
  const syncedCount = useMemo(() => items.filter((i) => i.state === 'synced').length, [items]);

  const value = useMemo(
    () => ({
      items,
      failedCount,
      queuedCount,
      syncingCount,
      syncedCount,
      isProcessing,
      isRetryingBulk,
      bulkProgress,
      bulkSummaryNotice,
      enqueue,
      refresh,
      retry: retrySingle,
      retryAllFailed,
      dismissSynced,
      clearSummaryNotice,
    }),
    [
      bulkProgress,
      bulkSummaryNotice,
      clearSummaryNotice,
      dismissSynced,
      enqueue,
      failedCount,
      isProcessing,
      isRetryingBulk,
      items,
      queuedCount,
      refresh,
      retryAllFailed,
      retrySingle,
      syncedCount,
      syncingCount,
    ]
  );

  return <CaptureQueueContext.Provider value={value}>{children}</CaptureQueueContext.Provider>;
}

export function useCaptureQueue() {
  const value = useContext(CaptureQueueContext);
  if (!value) throw new Error('useCaptureQueue must be used inside CaptureQueueProvider.');
  return value;
}
