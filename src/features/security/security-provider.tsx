import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  getAutoLockTimeout,
  getUnlockMethod,
  isBiometricActive,
  isBiometricEnabled,
  logLockDiagnostic,
  type AutoLockTimeout,
  type UnlockMethod,
} from './security-storage';

interface SecurityContextValue {
  initialized: boolean;
  unlockMethod: UnlockMethod;
  isConfigured: boolean;
  isUnlocked: boolean;
  autoLockTimeout: AutoLockTimeout;
  biometricEnabled: boolean;
  pendingDeepLink: string | null;
  setPendingDeepLink: (path: string | null) => void;
  unlock: () => void;
  lock: () => void;
  refreshSecurityState: () => Promise<void>;
}

const SecurityContext = createContext<SecurityContextValue>({
  initialized: false,
  unlockMethod: null,
  isConfigured: false,
  isUnlocked: false,
  autoLockTimeout: '1m',
  biometricEnabled: false,
  pendingDeepLink: null,
  setPendingDeepLink: () => {},
  unlock: () => {},
  lock: () => {},
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
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [autoLockTimeout, setAutoLockTimeoutState] = useState<AutoLockTimeout>('1m');
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);

  const backgroundTimeRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshSecurityState = async () => {
    try {
      const method = await getUnlockMethod();
      const timeout = await getAutoLockTimeout();
      const bioEnabled = await isBiometricEnabled();

      setUnlockMethodState(method);
      setAutoLockTimeoutState(timeout);
      setBiometricEnabledState(bioEnabled);

      if (!method) {
        setIsUnlocked(true); // Unconfigured devices do not block with unlock screen
      }
    } catch {
      // Graceful fallback
    } finally {
      setInitialized(true);
    }
  };

  useEffect(() => {
    void refreshSecurityState();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const isGoingBackground =
        appStateRef.current === 'active' &&
        (nextAppState === 'background' || nextAppState === 'inactive');

      const isReturningForeground =
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextAppState === 'active';

      if (isGoingBackground) {
        // Ignore background transitions caused by OS Biometric Prompt system overlay
        if (isBiometricActive()) {
          logLockDiagnostic('unlock_suppressed', { reason: 'biometric_overlay_active' });
          return;
        }
        backgroundTimeRef.current = Date.now();
      }

      if (isReturningForeground && backgroundTimeRef.current !== null && unlockMethod !== null) {
        const elapsed = Date.now() - backgroundTimeRef.current;
        const maxAllowed = getTimeoutMs(autoLockTimeout);
        if (elapsed >= maxAllowed) {
          logLockDiagnostic('relock_triggered', { elapsed, maxAllowed });
          setIsUnlocked(false); // Relock Card Nest
        }
        backgroundTimeRef.current = null;
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [autoLockTimeout, unlockMethod]);

  const unlock = () => {
    logLockDiagnostic('unlock_state_changed', { isUnlocked: true });
    setIsUnlocked(true);
  };
  const lock = () => {
    logLockDiagnostic('unlock_state_changed', { isUnlocked: false });
    setIsUnlocked(false);
  };

  return (
    <SecurityContext.Provider
      value={{
        initialized,
        unlockMethod,
        isConfigured: unlockMethod !== null,
        isUnlocked,
        autoLockTimeout,
        biometricEnabled,
        pendingDeepLink,
        setPendingDeepLink,
        unlock,
        lock,
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
