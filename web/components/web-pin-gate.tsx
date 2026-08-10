'use client';

import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createWebLockConfig, timeoutMilliseconds, verifyWebPin, webLockStorageKey, type WebLockConfig } from '@/lib/web-lock';

function readConfig(key: string): WebLockConfig | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as WebLockConfig | null;
    return parsed?.version === 1 ? parsed : null;
  } catch { return null; }
}

export function WebPinGate({ children, userId, email }: { children: React.ReactNode; userId: string; email: string }) {
  const storageKey = useMemo(() => webLockStorageKey(userId), [userId]);
  const [config, setConfig] = useState<WebLockConfig | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [password, setPassword] = useState('');
  const [lastActivity, setLastActivity] = useState(() => Date.now());

  useEffect(() => {
    const frame = requestAnimationFrame(() => setConfig(readConfig(storageKey)));
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  const persist = useCallback((next: WebLockConfig) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setConfig(next);
  }, [storageKey]);

  useEffect(() => {
    if (!unlocked || !config) return;
    const activity = () => setLastActivity(Date.now());
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    for (const event of events) window.addEventListener(event, activity, { passive: true });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && config.timeout === 'immediately') setUnlocked(false);
      else if (document.visibilityState === 'visible') setLastActivity((value) => value);
    };
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(() => {
      const timeout = timeoutMilliseconds(config.timeout);
      if (timeout > 0 && Date.now() - lastActivity >= timeout) setUnlocked(false);
    }, 1000);
    return () => {
      for (const event of events) window.removeEventListener(event, activity);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [config, lastActivity, unlocked]);

  useEffect(() => {
    const lock = () => setUnlocked(false);
    window.addEventListener('cardnest:web-lock', lock);
    return () => window.removeEventListener('cardnest:web-lock', lock);
  }, []);

  async function setup() {
    setMessage(null);
    if (pin !== confirmPin) return setMessage('The two PIN entries do not match.');
    setBusy(true);
    try {
      const next = await createWebLockConfig(pin);
      persist(next); setPin(''); setConfirmPin(''); setUnlocked(true); setLastActivity(Date.now());
    } catch (error) { setMessage(error instanceof Error ? error.message : 'PIN setup failed.'); }
    finally { setBusy(false); }
  }

  async function unlock() {
    if (!config) return;
    setMessage(null); setBusy(true);
    try {
      const result = await verifyWebPin(pin, config); persist(result.config); setPin('');
      if (result.ok) { setUnlocked(true); setLastActivity(Date.now()); }
      else setMessage(result.waitSeconds ? `Incorrect PIN. Try again in ${result.waitSeconds} seconds.` : 'Incorrect PIN. Try again.');
    } finally { setBusy(false); }
  }

  async function recover() {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch('/api/auth/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message ?? 'Account verification failed.');
      localStorage.removeItem(storageKey); setConfig(null); setPin(''); setPassword(''); setShowRecovery(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Account verification failed.'); }
    finally { setBusy(false); }
  }

  if (config === undefined) return <div className="app-loading" role="status">Securing your Card Nest…</div>;
  if (unlocked) return <>{children}</>;

  const settingUp = config === null;
  return <main className="pin-gate"><section className="pin-card">
    <div className="pin-icon">{settingUp ? <ShieldCheck /> : <LockKeyhole />}</div>
    <p className="eyebrow">BROWSER-SPECIFIC APP LOCK</p>
    <h1>{settingUp ? 'Protect Card Nest on this browser' : 'Unlock Card Nest'}</h1>
    <p className="muted">{settingUp ? 'Create a six-digit PIN. It stays only in this browser as a salted WebCrypto verifier and never syncs to Card Nest.' : `Enter the six-digit Card Nest PIN for ${email}.`}</p>
    {message ? <div className="notice" role="alert">{message}</div> : null}
    {!showRecovery ? <div className="form-stack">
      <label>{settingUp ? 'Create PIN' : 'Card Nest PIN'}<input autoComplete="off" inputMode="numeric" maxLength={6} onChange={(event) => setPin(event.target.value.replace(/\D/gu, '').slice(0, 6))} pattern="[0-9]{6}" type="password" value={pin} /></label>
      {settingUp ? <label>Confirm PIN<input autoComplete="off" inputMode="numeric" maxLength={6} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/gu, '').slice(0, 6))} pattern="[0-9]{6}" type="password" value={confirmPin} /></label> : null}
      <button className="button button-primary" disabled={busy || pin.length !== 6 || (settingUp && confirmPin.length !== 6)} onClick={() => void (settingUp ? setup() : unlock())}>{busy ? 'Please wait…' : settingUp ? 'Protect this browser' : 'Unlock'}</button>
      {!settingUp ? <button className="text-button" onClick={() => { setMessage(null); setShowRecovery(true); }}>Forgot PIN?</button> : null}
    </div> : <div className="form-stack">
      <p className="muted">Verify your Card Nest account password to reset only this browser’s PIN.</p>
      <label>Account password<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label>
      <button className="button button-primary" disabled={busy || !password} onClick={() => void recover()}>Verify and reset PIN</button>
      <a className="button button-secondary" href="/api/auth/reauth/google">Reauthenticate with Google</a>
      <button className="button button-secondary" onClick={() => setShowRecovery(false)}>Cancel</button>
    </div>}
  </section></main>;
}
