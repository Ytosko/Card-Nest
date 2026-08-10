export type AutoLockTimeout = 'restart' | '1h' | '6h' | '12h';

export type WebLockConfig = {
  version: 2;
  configId: string;
  salt: string;
  verifier: string;
  iterations: number;
  timeout: AutoLockTimeout;
  failedAttempts: number;
  lockedUntil: number;
};

export type WebUnlockSession = {
  version: 1;
  userId: string;
  configId: string;
  unlockedAt: number;
  expiresAt: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

const iterations = 210_000;
const unlockPrefix = 'cardnest.web-unlock.v1.';

export const webLockChannelName = 'cardnest.web-lock.channel.v1';
export const webLockActiveUserKey = 'cardnest.web-lock.active-user.v1';

export function webLockStorageKey(userId: string) {
  return `cardnest.web-lock.v1.${userId}`;
}

export function webUnlockStorageKey(userId: string) {
  return `${unlockPrefix}${userId}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveVerifier(pin: string, salt: string, rounds = iterations) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(salt), iterations: rounds },
    material,
    256,
  );
  return bytesToBase64(new Uint8Array(result));
}

function isTimeout(value: unknown): value is AutoLockTimeout {
  return value === 'restart' || value === '1h' || value === '6h' || value === '12h';
}

function randomConfigId() {
  return crypto.randomUUID();
}

export function readWebLockConfig(storage: StorageLike, key: string): WebLockConfig | null {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? 'null') as Partial<WebLockConfig> & { version?: number } | null;
    if (!parsed || typeof parsed.salt !== 'string' || typeof parsed.verifier !== 'string' || typeof parsed.iterations !== 'number') return null;

    if (parsed.version === 2 && typeof parsed.configId === 'string' && isTimeout(parsed.timeout)) {
      return {
        version: 2,
        configId: parsed.configId,
        salt: parsed.salt,
        verifier: parsed.verifier,
        iterations: parsed.iterations,
        timeout: parsed.timeout,
        failedAttempts: Number(parsed.failedAttempts) || 0,
        lockedUntil: Number(parsed.lockedUntil) || 0,
      };
    }

    // Preserve legacy PBKDF2 verifier material while moving minute-based web
    // policies to the new six-hour default.
    const migrated: WebLockConfig = {
      version: 2,
      configId: randomConfigId(),
      salt: parsed.salt,
      verifier: parsed.verifier,
      iterations: parsed.iterations,
      timeout: '6h',
      failedAttempts: Number(parsed.failedAttempts) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0,
    };
    storage.setItem(key, JSON.stringify(migrated));
    return migrated;
  } catch {
    return null;
  }
}

export async function createWebLockConfig(pin: string, timeout: AutoLockTimeout = '6h'): Promise<WebLockConfig> {
  if (!/^\d{6}$/u.test(pin)) throw new Error('Use exactly six digits.');
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  return {
    version: 2,
    configId: randomConfigId(),
    salt,
    verifier: await deriveVerifier(pin, salt),
    iterations,
    timeout,
    failedAttempts: 0,
    lockedUntil: 0,
  };
}

export async function verifyWebPin(pin: string, config: WebLockConfig) {
  const now = Date.now();
  if (config.lockedUntil > now) return { ok: false, config, waitSeconds: Math.ceil((config.lockedUntil - now) / 1000) };
  const verifier = await deriveVerifier(pin, config.salt, config.iterations);
  if (verifier === config.verifier) return { ok: true, config: { ...config, failedAttempts: 0, lockedUntil: 0 } };
  const failedAttempts = config.failedAttempts + 1;
  const delay = failedAttempts >= 8 ? 60_000 : failedAttempts >= 6 ? 30_000 : failedAttempts >= 4 ? 15_000 : failedAttempts >= 3 ? 5_000 : 0;
  return { ok: false, config: { ...config, failedAttempts, lockedUntil: now + delay }, waitSeconds: Math.ceil(delay / 1000) };
}

export function timeoutMilliseconds(timeout: AutoLockTimeout) {
  if (timeout === 'restart') return Number.POSITIVE_INFINITY;
  if (timeout === '1h') return 60 * 60 * 1000;
  if (timeout === '12h') return 12 * 60 * 60 * 1000;
  return 6 * 60 * 60 * 1000;
}

export function createWebUnlockSession(userId: string, config: WebLockConfig, now = Date.now()): WebUnlockSession {
  const duration = timeoutMilliseconds(config.timeout);
  return {
    version: 1,
    userId,
    configId: config.configId,
    unlockedAt: now,
    expiresAt: Number.isFinite(duration) ? now + duration : Number.MAX_SAFE_INTEGER,
  };
}

export function rebaseWebUnlockSession(session: WebUnlockSession, timeout: AutoLockTimeout) {
  const duration = timeoutMilliseconds(timeout);
  return {
    ...session,
    expiresAt: Number.isFinite(duration) ? session.unlockedAt + duration : Number.MAX_SAFE_INTEGER,
  };
}

export function isWebUnlockSessionValid(session: WebUnlockSession | null, userId: string, config: WebLockConfig, now = Date.now()) {
  return Boolean(
    session &&
    session.version === 1 &&
    session.userId === userId &&
    session.configId === config.configId &&
    session.unlockedAt <= now &&
    session.expiresAt > now,
  );
}

export function readWebUnlockSession(storage: StorageLike, userId: string) {
  try {
    const parsed = JSON.parse(storage.getItem(webUnlockStorageKey(userId)) ?? 'null') as WebUnlockSession | null;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWebUnlockSession(storage: StorageLike, session: WebUnlockSession) {
  storage.setItem(webUnlockStorageKey(session.userId), JSON.stringify(session));
}

export function clearWebUnlockSession(storage: StorageLike, userId: string) {
  storage.removeItem(webUnlockStorageKey(userId));
}

export function clearAllWebUnlockSessions(storage: StorageLike) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(unlockPrefix)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}
