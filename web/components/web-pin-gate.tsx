'use client';

import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  clearAllWebUnlockSessions,
  clearWebUnlockSession,
  createWebLockConfig,
  createWebUnlockSession,
  isWebUnlockSessionValid,
  readWebLockConfig,
  readWebUnlockSession,
  rebaseWebUnlockSession,
  verifyWebPin,
  webLockActiveUserKey,
  webLockChannelName,
  webLockStorageKey,
  writeWebUnlockSession,
  type WebLockConfig,
  type WebUnlockSession,
} from '@/lib/web-lock';

type WebLockMessage =
  | { type: 'request-unlock'; userId: string }
  | { type: 'unlock'; userId: string; session: WebUnlockSession }
  | { type: 'lock'; userId: string };

export function WebPinGate({ children, userId, email }: { children: React.ReactNode; userId: string; email: string }) {
  const storageKey = useMemo(() => webLockStorageKey(userId), [userId]);
  const [config, setConfig] = useState<WebLockConfig | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [password, setPassword] = useState('');
  const configRef = useRef<WebLockConfig | null>(null);
  const sessionRef = useRef<WebUnlockSession | null>(null);
  const expiredRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const persistConfig = useCallback((next: WebLockConfig) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    configRef.current = next;
    setConfig(next);
  }, [storageKey]);

  const lock = useCallback((broadcast = true, clearAll = false) => {
    if (clearAll) clearAllWebUnlockSessions(sessionStorage);
    else clearWebUnlockSession(sessionStorage, userId);
    sessionRef.current = null;
    expiredRef.current = false;
    setUnlocked(false);
    setCheckingSession(false);
    if (broadcast) channelRef.current?.postMessage({ type: 'lock', userId } satisfies WebLockMessage);
  }, [userId]);

  const acceptSession = useCallback((session: WebUnlockSession, nextConfig: WebLockConfig) => {
    if (!isWebUnlockSessionValid(session, userId, nextConfig)) return false;
    writeWebUnlockSession(sessionStorage, session);
    sessionRef.current = session;
    expiredRef.current = false;
    setUnlocked(true);
    setCheckingSession(false);
    return true;
  }, [userId]);

  const syncConfig = useCallback(() => {
    const previous = configRef.current;
    const next = readWebLockConfig(localStorage, storageKey);
    configRef.current = next;
    setConfig(next);
    if (!next) {
      lock(false);
      return;
    }
    if (previous && previous.configId !== next.configId) {
      lock();
      return;
    }
    const currentSession = sessionRef.current ?? readWebUnlockSession(sessionStorage, userId);
    if (currentSession) {
      const rebased = rebaseWebUnlockSession(currentSession, next.timeout);
      writeWebUnlockSession(sessionStorage, rebased);
      sessionRef.current = rebased;
      expiredRef.current = !isWebUnlockSessionValid(rebased, userId, next);
    }
  }, [lock, storageKey, userId]);

  useEffect(() => {
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(webLockChannelName);
    let handshakeTimer: number | undefined;
    channelRef.current = channel;
    if (channel) {
      channel.onmessage = (event: MessageEvent<WebLockMessage>) => {
        const payload = event.data;
        if (!payload || payload.userId !== userId) return;
        if (payload.type === 'lock') {
          lock(false);
          return;
        }
        const currentConfig = configRef.current;
        if (!currentConfig) return;
        if (payload.type === 'request-unlock') {
          const currentSession = sessionRef.current;
          if (currentSession && isWebUnlockSessionValid(currentSession, userId, currentConfig)) {
            channel.postMessage({ type: 'unlock', userId, session: currentSession } satisfies WebLockMessage);
          }
          return;
        }
        if (payload.type === 'unlock') acceptSession(payload.session, currentConfig);
      };
    }

    const frame = requestAnimationFrame(() => {
      const activeUser = sessionStorage.getItem(webLockActiveUserKey);
      if (activeUser && activeUser !== userId) clearAllWebUnlockSessions(sessionStorage);
      sessionStorage.setItem(webLockActiveUserKey, userId);

      const storedConfig = readWebLockConfig(localStorage, storageKey);
      configRef.current = storedConfig;
      setConfig(storedConfig);
      if (!storedConfig) {
        setCheckingSession(false);
        return;
      }

      const storedSession = readWebUnlockSession(sessionStorage, userId);
      if (storedSession && acceptSession(storedSession, storedConfig)) return;
      channel?.postMessage({ type: 'request-unlock', userId } satisfies WebLockMessage);
      handshakeTimer = window.setTimeout(() => setCheckingSession(false), 180);
    });

    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === localStorage && event.key === storageKey) syncConfig();
    };
    const onLock = (event: Event) => {
      const detail = (event as CustomEvent<{ clearAll?: boolean }>).detail;
      lock(true, Boolean(detail?.clearAll));
    };
    const onPolicy = () => syncConfig();
    const onSafeTransition = () => {
      const currentConfig = configRef.current;
      const currentSession = sessionRef.current;
      if (currentConfig && !isWebUnlockSessionValid(currentSession, userId, currentConfig)) lock();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('cardnest:web-lock', onLock);
    window.addEventListener('cardnest:web-lock-policy', onPolicy);
    window.addEventListener('cardnest:web-safe-transition', onSafeTransition);

    return () => {
      cancelAnimationFrame(frame);
      if (handshakeTimer) window.clearTimeout(handshakeTimer);
      channel?.close();
      channelRef.current = null;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('cardnest:web-lock', onLock);
      window.removeEventListener('cardnest:web-lock-policy', onPolicy);
      window.removeEventListener('cardnest:web-safe-transition', onSafeTransition);
    };
  }, [acceptSession, lock, storageKey, syncConfig, userId]);

  useEffect(() => {
    if (!unlocked || !config) return;
    const checkExpiration = () => {
      expiredRef.current = !isWebUnlockSessionValid(sessionRef.current, userId, config);
    };
    const onVisibility = () => {
      checkExpiration();
      if (document.visibilityState === 'visible' && expiredRef.current) lock();
    };
    const timer = window.setInterval(checkExpiration, 30_000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [config, lock, unlocked, userId]);

  function establishUnlock(nextConfig: WebLockConfig) {
    const session = createWebUnlockSession(userId, nextConfig);
    writeWebUnlockSession(sessionStorage, session);
    sessionRef.current = session;
    expiredRef.current = false;
    setUnlocked(true);
    setCheckingSession(false);
    channelRef.current?.postMessage({ type: 'unlock', userId, session } satisfies WebLockMessage);
  }

  async function setup() {
    setMessage(null);
    if (pin !== confirmPin) return setMessage('The two PIN entries do not match.');
    setBusy(true);
    try {
      const next = await createWebLockConfig(pin);
      persistConfig(next);
      setPin('');
      setConfirmPin('');
      establishUnlock(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'PIN setup failed.');
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    if (!config) return;
    setMessage(null);
    setBusy(true);
    try {
      const result = await verifyWebPin(pin, config);
      persistConfig(result.config);
      setPin('');
      if (result.ok) establishUnlock(result.config);
      else setMessage(result.waitSeconds ? `Incorrect PIN. Try again in ${result.waitSeconds} seconds.` : 'Incorrect PIN. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function recover() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message ?? 'Account verification failed.');
      localStorage.removeItem(storageKey);
      clearAllWebUnlockSessions(sessionStorage);
      configRef.current = null;
      sessionRef.current = null;
      setConfig(null);
      setPin('');
      setPassword('');
      setShowRecovery(false);
      channelRef.current?.postMessage({ type: 'lock', userId } satisfies WebLockMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Account verification failed.');
    } finally {
      setBusy(false);
    }
  }

  if (config === undefined || checkingSession) return <div className="app-loading" role="status">Securing your Card Nest…</div>;
  const settingUp = config === null;
  return <>
    <div aria-hidden={!unlocked} className={unlocked ? 'web-pin-content' : 'web-pin-content web-pin-content-locked'} inert={unlocked ? undefined : true}>{children}</div>
    {!unlocked ? <main className="pin-gate"><section className="pin-card">
    <div className="pin-icon">{settingUp ? <ShieldCheck /> : <LockKeyhole />}</div>
    <p className="eyebrow">BROWSER-SPECIFIC APP LOCK</p>
    <h1>{settingUp ? 'Protect Card Nest on this browser' : 'Unlock Card Nest'}</h1>
    <p className="muted">{settingUp ? 'Create a six-digit PIN. It stays only in this browser as a salted WebCrypto verifier and never syncs to Card Nest.' : `Enter the six-digit Card Nest PIN for ${email}. A successful unlock lasts six hours by default.`}</p>
    {message ? <div className="notice" role="alert">{message}</div> : null}
    {!showRecovery ? <div className="form-stack">
      <label>{settingUp ? 'Create PIN' : 'Card Nest PIN'}<input autoComplete="off" autoFocus inputMode="numeric" maxLength={6} onChange={(event) => setPin(event.target.value.replace(/\D/gu, '').slice(0, 6))} pattern="[0-9]{6}" type="password" value={pin} /></label>
      {settingUp ? <label>Confirm PIN<input autoComplete="off" inputMode="numeric" maxLength={6} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/gu, '').slice(0, 6))} pattern="[0-9]{6}" type="password" value={confirmPin} /></label> : null}
      <button className="button button-primary" disabled={busy || pin.length !== 6 || (settingUp && confirmPin.length !== 6)} onClick={() => void (settingUp ? setup() : unlock())}>{busy ? 'Please wait…' : settingUp ? 'Protect this browser' : 'Unlock Card Nest'}</button>
      {!settingUp ? <button className="text-button" onClick={() => { setMessage(null); setShowRecovery(true); }}>Forgot PIN?</button> : null}
    </div> : <div className="form-stack">
      <p className="muted">Verify your Card Nest account password to reset only this browser’s PIN.</p>
      <label>Account password<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label>
      <button className="button button-primary" disabled={busy || !password} onClick={() => void recover()}>Verify and reset PIN</button>
      <a className="button button-secondary" href="/api/auth/reauth/google">Reauthenticate with Google</a>
      <button className="button button-secondary" onClick={() => setShowRecovery(false)}>Cancel</button>
    </div>}
    </section></main> : null}
  </>;
}
