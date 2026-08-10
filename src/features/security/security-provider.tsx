import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  authenticateWithBiometrics,
  getAutoLockTimeout,
  getUnlockMethod,
  isBiometricActive,
  isBiometricEnabled,
  logLockDiagnostic,
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
  const [initialized, setInitialized] = useState(false);
  const [unlockMethod, setUnlockMethodState] = useState<UnlockMethod>(null);
  const [lockState, setLockState] = useState<LockState>('LOCKED');
  const [autoLockTimeout, setAutoLockTimeoutState] = useState<AutoLockTimeout>('1m');
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);

  const backgroundTimeRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isBiometricOverlayActiveRef = useRef<boolean>(false);

  const refreshSecurityState = useCallback(async () => {
    try {
      const method = await getUnlockMethod();
      const timeout = await getAutoLockTimeout();
      const bioEnabled = await isBiometricEnabled();

      setUnlockMethodState(method);
      setAutoLockTimeoutState(timeout);
      setBiometricEnabledState(bioEnabled);

      if (!method) {
        setLockState('UNCONFIGURED');
      } else if (lockState === 'UNCONFIGURED') {
        setLockState('LOCKED');
      }
    } catch {
      // Graceful fallback
    } finally {
      setInitialized(true);
    }
  }, [lockState]);

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
          setLockState('LOCKED');
        }
        backgroundTimeRef.current = null;
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [autoLockTimeout, unlockMethod]);

  const unlock = useCallback(() => {
    logLockDiagnostic('unlock_state_changed', { isUnlocked: true });
    setLockState('UNLOCKED');
  }, []);

  const lock = useCallback(() => {
    logLockDiagnostic('unlock_state_changed', { isUnlocked: false });
    setLockState('LOCKED');
  }, []);

  const triggerBiometricUnlock = useCallback(async (source = 'unknown'): Promise<boolean> => {
    if (lockState === 'UNLOCKED') {
      console.log(`[BIOMETRIC_SKIPPED state=UNLOCKED reason=already_unlocked source=${source}]`);
      return true;
    }

    if (isBiometricOverlayActiveRef.current) {
      console.log(`[BIOMETRIC_SKIPPED state=AUTHENTICATING reason=already_in_progress source=${source}]`);
      return false;
    }

    setLockState('AUTHENTICATING');
    isBiometricOverlayActiveRef.current = true;

    try {
      const success = await authenticateWithBiometrics(source);
      if (success) {
        setLockState('UNLOCKED');
        return true;
      } else {
        setLockState('LOCKED');
        return false;
      }
    } catch {
      setLockState('LOCKED');
      return false;
    }
  }, [lockState]);

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
