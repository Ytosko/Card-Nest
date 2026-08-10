import type { LockState } from './security-provider';
import type { UnlockMethod } from './security-storage';

export function shouldRequestAutomaticBiometric({
  authInitialized,
  hasSession,
  securityInitialized,
  unlockMethod,
  biometricEnabled,
  lockState,
  attemptConsumed,
}: {
  authInitialized: boolean;
  hasSession: boolean;
  securityInitialized: boolean;
  unlockMethod: UnlockMethod;
  biometricEnabled: boolean;
  lockState: LockState;
  attemptConsumed: boolean;
}): boolean {
  return (
    authInitialized &&
    hasSession &&
    securityInitialized &&
    unlockMethod === 'pin' &&
    biometricEnabled &&
    lockState === 'LOCKED' &&
    !attemptConsumed
  );
}
