import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/src/features/auth/auth-provider';
import { PASSKEY_ENABLED } from '@/src/features/auth/auth-flags';

import { shouldRequestAutomaticBiometric } from './security-coordinator';

import {
  authenticateWithBiometrics,
  getAutoLockTimeout,
  getUnlockMethod,
  isBiometricActive,
  isBiometricEnabled,
  logLockDiagnostic,
  setUnlockMethod,
  type AutoLockTimeout,
  type UnlockMethod,
} from './security-storage';

export type LockState = 'UNCONFIGURED' | 'LOCKED' | 'AUTHENTICATING' | 'UNLOCKED';

interface SecurityContextValue {
  initialized: boolean;
  unlockMethod: UnlockMethod;
  lockState: LockState;
  isConfigured: boolean;
  isUnlocked: boolean;
  autoLockTimeout: AutoLockTimeout;
  biometricEnabled: boolean;
  pendingDeepLink: string | null;
  setPendingDeepLink: (path: string | null) => void;
  unlock: () => void;
  lock: () => void;
  triggerBiometricUnlock: (source?: string) => Promise<boolean>;
  refreshSecurityState: () => Promise<void>;
}

const SecurityContext = createContext<SecurityContextValue>({
  initialized: false,
  unlockMethod: null,
  lockState: 'UNCONFIGURED',
  isConfigured: false,
  isUnlocked: false,
  autoLockTimeout: '1m',
  biometricEnabled: false,
  pendingDeepLink: null,
  setPendingDeepLink: () => {},
  unlock: () => {},
  lock: () => {},
  triggerBiometricUnlock: async () => false,
  refreshSecurityState: async () => {},
});

function getTimeoutMs(timeout: AutoLockTimeout): number {
  switch (timeout) {
    case 'immediately':
      return 0;
    case '1m':
      return 60 * 1000;
    case '5m':
      return 5 * 60 * 1000;
    case '15m':
      return 15 * 60 * 1000;
    default:
      return 60 * 1000;
  }
}

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const { initialized: authInitialized, session } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const [unlockMethod, setUnlockMethodState] = useState<UnlockMethod>(null);
  const [lockState, setLockState] = useState<LockState>('LOCKED');
  const [autoLockTimeout, setAutoLockTimeoutState] = useState<AutoLockTimeout>('1m');
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);

  const backgroundTimeRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isBiometricOverlayActiveRef = useRef<boolean>(false);
  const automaticBiometricAttemptConsumedRef = useRef(false);
  const biometricPromptPromiseRef = useRef<Promise<boolean> | null>(null);
  const lockStateRef = useRef<LockState>('LOCKED');

  const updateLockState = useCallback((nextState: LockState) => {
    lockStateRef.current = nextState;
    setLockState(nextState);
  }, []);

  const refreshSecurityState = useCallback(async () => {
    try {
      let method = await getUnlockMethod();
      const timeout = await getAutoLockTimeout();
      let bioEnabled = await isBiometricEnabled();

      // A previous experimental build could persist passkey as the local unlock
      // method. While the feature flag is off, return those users to mandatory
      // PIN setup instead of exposing or attempting the unreliable passkey flow.
      if (method === 'passkey' && !PASSKEY_ENABLED) {
        await setUnlockMethod(null);
        method = null;
        bioEnabled = false;
      }

      setUnlockMethodState(method);
      setAutoLockTimeoutState(timeout);
      setBiometricEnabledState(bioEnabled);

      if (!method) {
        updateLockState('UNCONFIGURED');
      } else if (lockStateRef.current === 'UNCONFIGURED') {
        automaticBiometricAttemptConsumedRef.current = false;
        updateLockState('LOCKED');
      }
    } catch {
      // Graceful fallback
    } finally {
      setInitialized(true);
    }
  }, [updateLockState]);

  useEffect(() => {
    void refreshSecurityState();
  }, [refreshSecurityState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const isGoingBackground =
        appStateRef.current === 'active' &&
        (nextAppState === 'background' || nextAppState === 'inactive');

      const isReturningForeground =
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextAppState === 'active';

      // Explicit biometric overlay suppression mechanism
      if (isBiometricOverlayActiveRef.current || isBiometricActive()) {
        console.log(`[BIOMETRIC_SKIPPED state=${nextAppState} reason=biometric_overlay_active]`);
        if (nextAppState === 'active') {
          isBiometricOverlayActiveRef.current = false;
        }
        appStateRef.current = nextAppState;
        return;
      }

      if (isGoingBackground) {
        backgroundTimeRef.current = Date.now();
      }

      if (isReturningForeground && backgroundTimeRef.current !== null && unlockMethod !== null) {
        const elapsed = Date.now() - backgroundTimeRef.current;
        const maxAllowed = getTimeoutMs(autoLockTimeout);
        if (elapsed >= maxAllowed) {
          logLockDiagnostic('relock_triggered', { elapsed, maxAllowed });
          automaticBiometricAttemptConsumedRef.current = false;
          updateLockState('LOCKED');
        }
        backgroundTimeRef.current = null;
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [autoLockTimeout, unlockMethod, updateLockState]);

  const unlock = useCallback(() => {
    logLockDiagnostic('unlock_state_changed', { isUnlocked: true });
    automaticBiometricAttemptConsumedRef.current = true;
    updateLockState('UNLOCKED');
  }, [updateLockState]);

  const lock = useCallback(() => {
    logLockDiagnostic('unlock_state_changed', { isUnlocked: false });
    automaticBiometricAttemptConsumedRef.current = false;
    updateLockState('LOCKED');
  }, [updateLockState]);

  const triggerBiometricUnlock = useCallback(async (source = 'unknown'): Promise<boolean> => {
    if (lockStateRef.current === 'UNLOCKED') {
      console.log(`[BIOMETRIC_SKIPPED state=UNLOCKED reason=already_unlocked source=${source}]`);
      return true;
    }

    if (biometricPromptPromiseRef.current) {
      console.log(`[BIOMETRIC_SKIPPED state=AUTHENTICATING reason=already_in_progress source=${source}]`);
      return biometricPromptPromiseRef.current;
    }

    updateLockState('AUTHENTICATING');
    isBiometricOverlayActiveRef.current = true;
    const promptPromise = (async () => {
      try {
        const success = await authenticateWithBiometrics(source);
        updateLockState(success ? 'UNLOCKED' : 'LOCKED');
        return success;
      } catch {
        updateLockState('LOCKED');
        return false;
      } finally {
        biometricPromptPromiseRef.current = null;
      }
    })();
    biometricPromptPromiseRef.current = promptPromise;
    return promptPromise;
  }, [updateLockState]);

  // Automatic biometric prompting belongs to the security coordinator, not a
  // screen. One lock lifecycle consumes at most one automatic attempt, so a
  // cancellation cannot immediately reopen the OS prompt after LOCKED resumes.
  useEffect(() => {
    const shouldPrompt = shouldRequestAutomaticBiometric({
      authInitialized,
      hasSession: Boolean(session),
      securityInitialized: initialized,
      unlockMethod,
      biometricEnabled,
      lockState,
      attemptConsumed: automaticBiometricAttemptConsumedRef.current,
    });
    if (!shouldPrompt) return;

    automaticBiometricAttemptConsumedRef.current = true;
    void triggerBiometricUnlock('security_coordinator_auto');
  }, [
    authInitialized,
    biometricEnabled,
    initialized,
    lockState,
    session,
    triggerBiometricUnlock,
    unlockMethod,
  ]);

  const isUnlocked = lockState === 'UNCONFIGURED' || lockState === 'UNLOCKED';

  return (
    <SecurityContext.Provider
      value={{
        initialized,
        unlockMethod,
        lockState,
        isConfigured: unlockMethod !== null,
        isUnlocked,
        autoLockTimeout,
        biometricEnabled,
        pendingDeepLink,
        setPendingDeepLink,
        unlock,
        lock,
        triggerBiometricUnlock,
        refreshSecurityState,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  return useContext(SecurityContext);
}
