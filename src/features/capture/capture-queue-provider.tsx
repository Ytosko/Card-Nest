import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { useNetworkState } from 'expo-network';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/src/features/auth/auth-provider';
import { runConfiguredExtraction } from '@/src/features/ai/extraction-service';
import { getCardImageStoragePath } from '@/src/lib/supabase/storage-paths';
import { supabase } from '@/src/lib/supabase/client';

import { prepareCaptureFiles, removePreparedCapture } from './capture-files';
import { insertQueueItem, listQueueItems, removeQueueItem, updateQueueItem, type CaptureQueueItem } from './capture-queue-db';

type CaptureQueueContextValue = {
  items: CaptureQueueItem[];
  isProcessing: boolean;
  enqueue: (frontUri: string, backUri?: string | null) => Promise<string>;
  refresh: () => Promise<void>;
  retry: (itemId?: string) => Promise<void>;
  dismissSynced: () => Promise<void>;
};

const CaptureQueueContext = createContext<CaptureQueueContextValue | null>(null);

export function CaptureQueueProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const network = useNetworkState();
  const [items, setItems] = useState<CaptureQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  const refresh = useCallback(async () => {
    setItems(user ? await listQueueItems(user.id) : []);
  }, [user]);

  const processQueue = useCallback(async (onlyId?: string) => {
    if (!user || network.isConnected === false || processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    try {
      const queue = await listQueueItems(user.id);
      for (const item of queue) {
        if (onlyId && item.id !== onlyId) continue;
        if (!['queued', 'failed', 'uploading', 'processing'].includes(item.state)) continue;
        if (item.nextRetryAt && Date.parse(item.nextRetryAt) > Date.now() && !onlyId) continue;

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
            const file = new File(side.uri);
            const { error: uploadError } = await supabase.storage
              .from('card-images')
              .upload(side.path, await file.arrayBuffer(), { contentType: 'image/jpeg', upsert: true });
            if (uploadError) throw uploadError;

            const { error: metadataError } = await supabase.from('card_images').upsert(
              {
                user_id: user.id,
                card_id: item.cardId,
                side: side.side,
                storage_path: side.path,
                mime_type: 'image/jpeg',
                byte_size: file.size || null,
              },
              { onConflict: 'card_id,side' }
            );
            if (metadataError) throw metadataError;
          }

          await updateQueueItem(item.id, 'processing', { attemptCount: attempt, lastError: null, nextRetryAt: null });
          await refresh();

          const extracted = await runConfiguredExtraction(item.cardId, user.id, sides.map((captured) => captured.uri));

          if (!extracted) {
            await updateQueueItem(item.id, 'failed', {
              attemptCount: attempt,
              lastError: 'Could not extract card details. Check AI settings or connection and retry.',
              nextRetryAt: null,
            });
          } else {
            await updateQueueItem(item.id, 'synced', { attemptCount: attempt, lastError: null, nextRetryAt: null });
            removePreparedCapture(item.id);
          }
        } catch (catchedError) {
          const delayMinutes = Math.min(2 ** Math.min(attempt, 6), 60);
          const errMessage = catchedError instanceof Error ? catchedError.message : 'Upload paused. Card Nest will retry when connected.';
          await updateQueueItem(item.id, 'failed', {
            attemptCount: attempt,
            lastError: errMessage,
            nextRetryAt: new Date(Date.now() + delayMinutes * 60_000 + Math.random() * 15_000).toISOString(),
          });
        }
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
      await refresh();
    }
  }, [network.isConnected, refresh, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (network.isConnected !== false) void processQueue();
  }, [network.isConnected, processQueue]);

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

  const dismissSynced = useCallback(async () => {
    const synced = items.filter((item) => item.state === 'synced');
    await Promise.all(synced.map((item) => removeQueueItem(item.id)));
    await refresh();
  }, [items, refresh]);

  const value = useMemo(
    () => ({ items, isProcessing, enqueue, refresh, retry: processQueue, dismissSynced }),
    [dismissSynced, enqueue, isProcessing, items, processQueue, refresh]
  );

  return <CaptureQueueContext.Provider value={value}>{children}</CaptureQueueContext.Provider>;
}

export function useCaptureQueue() {
  const value = useContext(CaptureQueueContext);
  if (!value) throw new Error('useCaptureQueue must be used inside CaptureQueueProvider.');
  return value;
}
