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
import { deleteFailedCaptureArtifacts } from '@/src/features/cards/card-service';
import { getCardImageStoragePath } from '@/src/lib/supabase/storage-paths';
import { supabase } from '@/src/lib/supabase/client';

import { prepareCaptureFiles, readCardImageBytes, removePreparedCapture, toUploadArrayBuffer } from './capture-files';
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

export type BulkDeleteResult = {
  deletedTotal: number;
  failedTotal: number;
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
  isDeletingFailed: boolean;
  bulkProgress: BulkProgressInfo | null;
  bulkSummaryNotice: string | null;
  enqueue: (frontUri: string, backUri?: string | null) => Promise<string>;
  refresh: () => Promise<void>;
  retry: (itemId?: string) => Promise<void>;
  retryAllFailed: () => Promise<BulkRetryResult>;
  deleteFailed: (itemId: string) => Promise<void>;
  deleteAllFailed: () => Promise<BulkDeleteResult>;
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
  const [isDeletingFailed, setIsDeletingFailed] = useState(false);
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
          // React Native has no Node Buffer — read raw bytes via expo-file-system and
          // upload as an ArrayBuffer, the Supabase-documented binary path for RN.
          const imageResult = await readCardImageBytes(side.uri, item.cardId, side.side, user.id);
          const body = toUploadArrayBuffer(imageResult.bytes);

          if (__DEV__) {
            console.log(`[CardNest Queue] Uploading card image`, {
              jobId: item.id,
              cardId: item.cardId,
              side: side.side,
              stage: 'upload',
              uriScheme: side.uri.slice(0, 15),
              byteSize: imageResult.byteSize,
              mimeType: 'image/jpeg',
              source: imageResult.source,
            });
          }

          const { error: uploadError } = await supabase.storage
            .from('card-images')
            .upload(side.path, body, { contentType: 'image/jpeg', upsert: true });
          if (uploadError) throw uploadError;

          const { error: metadataError } = await supabase.from('card_images').upsert(
            {
              user_id: user.id,
              card_id: item.cardId,
              side: side.side,
              storage_path: side.path,
              mime_type: 'image/jpeg',
              byte_size: imageResult.byteSize || null,
            },
            { onConflict: 'card_id,side' }
          );
          if (metadataError) throw metadataError;
        }

        // Remote verification: confirm every uploaded image is actually present in the
        // user's private Storage folder with a non-zero size before continuing.
        const { data: remoteObjects, error: verifyError } = await supabase.storage
          .from('card-images')
          .list(`${user.id}/${item.cardId}`);
        if (verifyError) throw verifyError;
        for (const side of sides) {
          const expectedName = side.path.split('/').pop();
          const remote = remoteObjects?.find((object) => object.name === expectedName);
          const remoteSize = (remote?.metadata as { size?: number } | null | undefined)?.size;
          if (!remote || remoteSize === 0) {
            throw new Error(`Uploaded ${side.side} image was not found in cloud storage. Retrying.`);
          }
          if (__DEV__) {
            console.log(`[CardNest Queue] Verified uploaded image in cloud storage`, {
              jobId: item.id,
              cardId: item.cardId,
              side: side.side,
              stage: 'verify',
              remoteByteSize: remoteSize ?? null,
            });
          }
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

  const deleteFailedItem = useCallback(
    async (item: CaptureQueueItem) => {
      // Cloud cleanup first: orphan card images, draft extraction data, and the placeholder
      // card record (never a saved contact). Related processing_jobs rows cascade with the
      // card record.
      await deleteFailedCaptureArtifacts(item.cardId, item.userId);
      // Then durable local capture files and the queue record itself.
      removePreparedCapture(item.id);
      await removeQueueItem(item.id);
    },
    []
  );

  const deleteFailed = useCallback(
    async (itemId: string) => {
      if (!user) return;
      const currentItems = await listQueueItems(user.id);
      const item = currentItems.find((candidate) => candidate.id === itemId && candidate.state === 'failed');
      if (!item) return;
      await deleteFailedItem(item);
      await refresh();
    },
    [deleteFailedItem, refresh, user]
  );

  const deleteAllFailed = useCallback(async (): Promise<BulkDeleteResult> => {
    if (!user) return { deletedTotal: 0, failedTotal: 0 };

    const currentItems = await listQueueItems(user.id);
    const failedItems = currentItems.filter((item) => item.state === 'failed');
    if (failedItems.length === 0) return { deletedTotal: 0, failedTotal: 0 };

    setIsDeletingFailed(true);
    setBulkSummaryNotice(null);
    setBulkProgress({ current: 0, total: failedItems.length });

    let deletedTotal = 0;
    let failedTotal = 0;

    for (let index = 0; index < failedItems.length; index++) {
      setBulkProgress({ current: index + 1, total: failedItems.length });
      try {
        await deleteFailedItem(failedItems[index]);
        deletedTotal++;
      } catch {
        failedTotal++;
      }
    }

    setIsDeletingFailed(false);
    setBulkProgress(null);
    await refresh();

    setBulkSummaryNotice(
      failedTotal === 0
        ? `${deletedTotal} failed ${deletedTotal === 1 ? 'scan' : 'scans'} deleted and cleaned up.`
        : `${deletedTotal} deleted · ${failedTotal} couldn't be deleted.`
    );

    return { deletedTotal, failedTotal };
  }, [deleteFailedItem, refresh, user]);

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
      isDeletingFailed,
      bulkProgress,
      bulkSummaryNotice,
      enqueue,
      refresh,
      retry: retrySingle,
      retryAllFailed,
      deleteFailed,
      deleteAllFailed,
      dismissSynced,
      clearSummaryNotice,
    }),
    [
      bulkProgress,
      bulkSummaryNotice,
      clearSummaryNotice,
      deleteAllFailed,
      deleteFailed,
      dismissSynced,
      enqueue,
      failedCount,
      isDeletingFailed,
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
