import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearAllWebUnlockSessions,
  createWebLockConfig,
  createWebUnlockSession,
  isWebUnlockSessionValid,
  readWebLockConfig,
  readWebUnlockSession,
  rebaseWebUnlockSession,
  timeoutMilliseconds,
  verifyWebPin,
  writeWebUnlockSession,
} from '../lib/web-lock.ts';

class MemoryStorage {
  #items = new Map();
  get length() { return this.#items.size; }
  getItem(key) { return this.#items.get(key) ?? null; }
  key(index) { return [...this.#items.keys()][index] ?? null; }
  removeItem(key) { this.#items.delete(key); }
  setItem(key, value) { this.#items.set(key, String(value)); }
}

test('PIN verifier remains one-way and six hours is the web default', async () => {
  const config = await createWebLockConfig('123456');
  assert.equal(config.timeout, '6h');
  assert.equal(JSON.stringify(config).includes('123456'), false);
  assert.equal((await verifyWebPin('123456', config)).ok, true);
  assert.equal((await verifyWebPin('654321', config)).ok, false);
});

test('unlock proof is bound to the authenticated user, PIN config, and expiry', async () => {
  const now = 1_800_000_000_000;
  const config = await createWebLockConfig('123456');
  const session = createWebUnlockSession('user-a', config, now);
  assert.equal(session.expiresAt, now + 6 * 60 * 60 * 1000);
  assert.equal(isWebUnlockSessionValid(session, 'user-a', config, now + 1), true);
  assert.equal(isWebUnlockSessionValid(session, 'user-b', config, now + 1), false);
  assert.equal(isWebUnlockSessionValid(session, 'user-a', { ...config, configId: 'changed' }, now + 1), false);
  assert.equal(isWebUnlockSessionValid(session, 'user-a', config, session.expiresAt), false);
});

test('web timeout policies rebase the same temporary unlock proof', async () => {
  const config = await createWebLockConfig('123456');
  const session = createWebUnlockSession('user-a', config, 1000);
  assert.equal(rebaseWebUnlockSession(session, '1h').expiresAt, 1000 + timeoutMilliseconds('1h'));
  assert.equal(rebaseWebUnlockSession(session, '12h').expiresAt, 1000 + timeoutMilliseconds('12h'));
  assert.equal(rebaseWebUnlockSession(session, 'restart').expiresAt, Number.MAX_SAFE_INTEGER);
});

test('clearing local security state invalidates every temporary account unlock', async () => {
  const storage = new MemoryStorage();
  const config = await createWebLockConfig('123456');
  writeWebUnlockSession(storage, createWebUnlockSession('user-a', config, 1000));
  writeWebUnlockSession(storage, createWebUnlockSession('user-b', config, 1000));
  clearAllWebUnlockSessions(storage);
  assert.equal(readWebUnlockSession(storage, 'user-a'), null);
  assert.equal(readWebUnlockSession(storage, 'user-b'), null);
});

test('legacy minute policies migrate without replacing verifier material', () => {
  const storage = new MemoryStorage();
  const key = 'legacy';
  storage.setItem(key, JSON.stringify({ version: 1, salt: 'salt', verifier: 'verifier', iterations: 210000, timeout: '5m', failedAttempts: 2, lockedUntil: 10 }));
  const migrated = readWebLockConfig(storage, key);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.timeout, '6h');
  assert.equal(migrated.salt, 'salt');
  assert.equal(migrated.verifier, 'verifier');
  assert.equal(migrated.failedAttempts, 2);
  assert.ok(migrated.configId);
});
