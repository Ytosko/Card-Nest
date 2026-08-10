import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type UnlockMethod = 'passkey' | 'pin' | null;
export type AutoLockTimeout = 'immediately' | '1m' | '5m' | '15m';

const KEYS = {
  UNLOCK_METHOD: 'cardnest_unlock_method',
  PIN_SALT: 'cardnest_pin_salt',
  PIN_VERIFIER: 'cardnest_pin_verifier',
  BIOMETRIC_ENABLED: 'cardnest_biometric_enabled',
  AUTOLOCK_TIMEOUT: 'cardnest_autolock_timeout',
  FAILED_ATTEMPTS: 'cardnest_failed_pin_attempts',
  LOCKOUT_UNTIL: 'cardnest_pin_lockout_until',
} as const;

// In-memory fallback for web environment where SecureStore is unavailable
const webMemoryStore: Record<string, string> = {};

// Single-flight state flag for OS biometric prompt
let isBiometricPromptActive = false;

export function isBiometricActive(): boolean {
  return isBiometricPromptActive;
}

export function logLockDiagnostic(event: string, meta?: Record<string, any>): void {
  // Sanitized logging: Zero PINs, tokens, biometrics, or secrets logged
  console.log(`[CardNest Lock Diagnostic] ${event}`, meta ? JSON.stringify(meta) : '');
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webMemoryStore[key] || null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webMemoryStore[key] = value;
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Graceful fallback if platform SecureStore fails
  }
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    delete webMemoryStore[key];
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Graceful fallback
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveVerifier(salt: string, pin: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + pin
  );
}

export async function getUnlockMethod(): Promise<UnlockMethod> {
  const method = await getItem(KEYS.UNLOCK_METHOD);
  if (method === 'passkey' || method === 'pin') return method;
  return null;
}

export async function setUnlockMethod(method: UnlockMethod): Promise<void> {
  if (!method) {
    await removeItem(KEYS.UNLOCK_METHOD);
  } else {
    await setItem(KEYS.UNLOCK_METHOD, method);
  }
}

export async function savePin(pin: string): Promise<void> {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('Card Nest PIN must be a 6-digit number.');
  }

  const randomBytes = await Crypto.getRandomBytesAsync(16);
  const salt = bytesToHex(randomBytes);
  const verifier = await deriveVerifier(salt, pin);

  await setItem(KEYS.PIN_SALT, salt);
  await setItem(KEYS.PIN_VERIFIER, verifier);
  await setItem(KEYS.UNLOCK_METHOD, 'pin');
  await removeItem(KEYS.FAILED_ATTEMPTS);
  await removeItem(KEYS.LOCKOUT_UNTIL);
}

export interface PinVerificationResult {
  success: boolean;
  error?: string;
  lockoutSeconds?: number;
  attemptsRemaining?: number;
  requireAccountReauth?: boolean;
}

export async function verifyPin(pin: string): Promise<PinVerificationResult> {
  const lockoutUntilStr = await getItem(KEYS.LOCKOUT_UNTIL);
  if (lockoutUntilStr) {
    const lockoutUntil = parseInt(lockoutUntilStr, 10);
    const now = Date.now();
    if (now < lockoutUntil) {
      const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
      return {
        success: false,
        error: `Too many failed attempts. Please wait ${remainingSeconds}s before trying again.`,
        lockoutSeconds: remainingSeconds,
      };
    } else {
      await removeItem(KEYS.LOCKOUT_UNTIL);
    }
  }

  const salt = await getItem(KEYS.PIN_SALT);
  const storedVerifier = await getItem(KEYS.PIN_VERIFIER);

  if (!salt || !storedVerifier) {
    return {
      success: false,
      error: 'No PIN is configured on this device.',
    };
  }

  const candidateVerifier = await deriveVerifier(salt, pin);
  if (candidateVerifier === storedVerifier) {
    await removeItem(KEYS.FAILED_ATTEMPTS);
    await removeItem(KEYS.LOCKOUT_UNTIL);
    return { success: true };
  }

  // Failed PIN handling & brute force protection
  const failedCountStr = await getItem(KEYS.FAILED_ATTEMPTS);
  const newCount = (parseInt(failedCountStr || '0', 10) || 0) + 1;
  await setItem(KEYS.FAILED_ATTEMPTS, String(newCount));

  if (newCount >= 10) {
    return {
      success: false,
      error: 'Too many incorrect PIN entries. Account re-authentication is required.',
      requireAccountReauth: true,
    };
  }

  if (newCount >= 5) {
    const lockoutUntil = Date.now() + 60 * 1000;
    await setItem(KEYS.LOCKOUT_UNTIL, String(lockoutUntil));
    return {
      success: false,
      error: '5 incorrect attempts. Please wait 60s.',
      lockoutSeconds: 60,
      attemptsRemaining: 10 - newCount,
    };
  }

  if (newCount >= 3) {
    const lockoutUntil = Date.now() + 30 * 1000;
    await setItem(KEYS.LOCKOUT_UNTIL, String(lockoutUntil));
    return {
      success: false,
      error: '3 incorrect attempts. Please wait 30s.',
      lockoutSeconds: 30,
      attemptsRemaining: 10 - newCount,
    };
  }

  return {
    success: false,
    error: 'Incorrect PIN. Please try again.',
    attemptsRemaining: 10 - newCount,
  };
}

export async function clearDeviceLock(): Promise<void> {
  await removeItem(KEYS.UNLOCK_METHOD);
  await removeItem(KEYS.PIN_SALT);
  await removeItem(KEYS.PIN_VERIFIER);
  await removeItem(KEYS.BIOMETRIC_ENABLED);
  await removeItem(KEYS.FAILED_ATTEMPTS);
  await removeItem(KEYS.LOCKOUT_UNTIL);
}

export async function getAutoLockTimeout(): Promise<AutoLockTimeout> {
  const timeout = await getItem(KEYS.AUTOLOCK_TIMEOUT);
  if (timeout === 'immediately' || timeout === '1m' || timeout === '5m' || timeout === '15m') {
    return timeout;
  }
  return '1m'; // Privacy-first default
}

export async function setAutoLockTimeout(timeout: AutoLockTimeout): Promise<void> {
  await setItem(KEYS.AUTOLOCK_TIMEOUT, timeout);
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await getItem(KEYS.BIOMETRIC_ENABLED);
  return val === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await setItem(KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
}

export async function hasLocalBiometricHardware(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export async function authenticateWithBiometrics(
  source = 'unknown',
  promptMessage = 'Unlock Card Nest'
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (isBiometricPromptActive) {
    logLockDiagnostic('unlock_suppressed', { reason: 'already_in_progress', source });
    return false;
  }

  try {
    const hasHardware = await hasLocalBiometricHardware();
    if (!hasHardware) return false;

    isBiometricPromptActive = true;
    logLockDiagnostic('unlock_requested', { source });

    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Card Nest PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: true,
    });

    if (res.success) {
      logLockDiagnostic('unlock_succeeded', { source });
      return true;
    } else {
      logLockDiagnostic('unlock_failed_or_cancelled', { source, error: res.error });
      return false;
    }
  } catch (err: any) {
    logLockDiagnostic('unlock_failed_exception', { source, error: err?.message });
    return false;
  } finally {
    isBiometricPromptActive = false;
  }
}
