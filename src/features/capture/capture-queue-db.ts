import { Platform } from 'react-native';

import * as NativeDb from './capture-queue-db.native';
import * as WebDb from './capture-queue-db.web';

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

const impl = Platform.OS === 'web' ? WebDb : NativeDb;

export const insertQueueItem = impl.insertQueueItem;
export const listQueueItems = impl.listQueueItems;
export const updateQueueItem = impl.updateQueueItem;
export const removeQueueItem = impl.removeQueueItem;
