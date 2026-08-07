import * as SQLite from 'expo-sqlite';

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

type QueueRow = {
  id: string;
  user_id: string;
  card_id: string;
  front_uri: string;
  back_uri: string | null;
  state: CaptureQueueState;
  attempt_count: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
};

let dbInstance: SQLite.SQLiteDatabase | null = null;

function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('cardnest-queue.db');
    dbInstance.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS capture_queue (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        card_id TEXT NOT NULL,
        front_uri TEXT NOT NULL,
        back_uri TEXT,
        state TEXT NOT NULL CHECK (state IN ('queued', 'uploading', 'processing', 'synced', 'failed')),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_retry_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS capture_queue_user_state_idx ON capture_queue (user_id, state, created_at);
    `);
  }
  return dbInstance;
}

function fromRow(row: QueueRow): CaptureQueueItem {
  return {
    id: row.id,
    userId: row.user_id,
    cardId: row.card_id,
    frontUri: row.front_uri,
    backUri: row.back_uri,
    state: row.state,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertQueueItem(
  item: Omit<CaptureQueueItem, 'state' | 'attemptCount' | 'lastError' | 'nextRetryAt' | 'createdAt' | 'updatedAt'>
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO capture_queue (id, user_id, card_id, front_uri, back_uri, state, attempt_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
    item.id,
    item.userId,
    item.cardId,
    item.frontUri,
    item.backUri,
    'queued',
    now,
    now
  );
}

export async function listQueueItems(userId: string): Promise<CaptureQueueItem[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<QueueRow>(
    'SELECT * FROM capture_queue WHERE user_id = ? ORDER BY created_at DESC',
    userId
  );
  return rows.map(fromRow);
}

export async function updateQueueItem(
  id: string,
  state: CaptureQueueState,
  values?: { attemptCount?: number; lastError?: string | null; nextRetryAt?: string | null }
) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE capture_queue SET state = ?, attempt_count = COALESCE(?, attempt_count), last_error = ?, next_retry_at = ?, updated_at = ? WHERE id = ?',
    state,
    values?.attemptCount ?? null,
    values?.lastError ?? null,
    values?.nextRetryAt ?? null,
    new Date().toISOString(),
    id
  );
}

export async function removeQueueItem(id: string) {
  const db = getDatabase();
  await db.runAsync('DELETE FROM capture_queue WHERE id = ?', id);
}
