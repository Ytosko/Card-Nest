export type AutoLockTimeout = 'immediately' | '1m' | '5m' | '15m';

export type WebLockConfig = {
  version: 1;
  salt: string;
  verifier: string;
  iterations: number;
  timeout: AutoLockTimeout;
  failedAttempts: number;
  lockedUntil: number;
};

const iterations = 210_000;

export function webLockStorageKey(userId: string) {
  return `cardnest.web-lock.v1.${userId}`;
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

export async function createWebLockConfig(pin: string, timeout: AutoLockTimeout = '5m'): Promise<WebLockConfig> {
  if (!/^\d{6}$/u.test(pin)) throw new Error('Use exactly six digits.');
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  return { version: 1, salt, verifier: await deriveVerifier(pin, salt), iterations, timeout, failedAttempts: 0, lockedUntil: 0 };
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
  return timeout === 'immediately' ? 0 : timeout === '1m' ? 60_000 : timeout === '5m' ? 300_000 : 900_000;
}
