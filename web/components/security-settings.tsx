'use client';

import { LoaderCircle, LockKeyhole } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  createWebLockConfig,
  readWebLockConfig,
  verifyWebPin,
  webLockStorageKey,
  type AutoLockTimeout,
  type WebLockConfig,
} from '@/lib/web-lock';

const timeoutOptions: Array<{ value: AutoLockTimeout; label: string; description: string }> = [
  { value: 'restart', label: 'On browser restart', description: 'Keep this tab session unlocked until the browser session ends.' },
  { value: '1h', label: 'After 1 hour', description: 'Require the PIN one hour after a successful unlock.' },
  { value: '6h', label: 'After 6 hours', description: 'Balanced protection for a normal Card Nest workday.' },
  { value: '12h', label: 'After 12 hours', description: 'Keep this browser unlocked for an extended workday.' },
];

export function SecuritySettings({ userId }: { userId: string }) {
  const key = useMemo(() => webLockStorageKey(userId), [userId]);
  const [config, setConfig] = useState<WebLockConfig | null>(null);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setConfig(readWebLockConfig(localStorage, key)));
    return () => cancelAnimationFrame(frame);
  }, [key]);

  function persist(next: WebLockConfig) {
    localStorage.setItem(key, JSON.stringify(next));
    setConfig(next);
    window.dispatchEvent(new Event('cardnest:web-lock-policy'));
  }

  function setTimeoutValue(timeout: AutoLockTimeout) {
    if (!config || busy) return;
    persist({ ...config, timeout });
    setMessage(`Card Nest will require the PIN ${timeoutOptions.find((option) => option.value === timeout)?.label.toLowerCase()}.`);
  }

  function lockNow() {
    window.dispatchEvent(new CustomEvent('cardnest:web-lock'));
  }

  async function changePin() {
    setMessage(null);
    if (!config) return;
    setBusy(true);
    try {
      const verified = await verifyWebPin(currentPin, config);
      if (!verified.ok) {
        persist(verified.config);
        setMessage('Current browser PIN is not correct.');
        return;
      }
      if (newPin !== confirmPin) {
        setMessage('The new PIN entries do not match.');
        return;
      }
      persist(await createWebLockConfig(newPin, config.timeout));
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      window.dispatchEvent(new CustomEvent('cardnest:web-lock'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'PIN change failed.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="settings-stack">
    {message ? <div className="notice success" role="status">{message}</div> : null}
    <section className="panel">
      <p className="eyebrow">UNLOCK SESSION</p>
      <h2>Require PIN again</h2>
      <p className="muted">Six hours is the web default. Refreshes and normal Card Nest navigation do not count as security events.</p>
      <div className="timeout-grid web-timeout-grid">{timeoutOptions.map((option) => <button aria-pressed={config?.timeout === option.value} className={config?.timeout === option.value ? 'active' : ''} disabled={busy || !config} key={option.value} onClick={() => setTimeoutValue(option.value)}><strong>{option.label}</strong><span>{option.description}</span></button>)}</div>
      <p className="form-help">Unlock proof is kept in browser-session storage and contains no PIN. A fully closed browser normally requires the PIN again; another open Card Nest tab can securely share the active unlock window.</p>
    </section>
    <section className="panel lock-now-panel">
      <div><p className="eyebrow">MANUAL LOCK</p><h2>Lock Card Nest now</h2><p className="muted">Immediately clear this browser session’s temporary unlock proof across open Card Nest tabs.</p></div>
      <button className="button button-secondary" onClick={lockNow}><LockKeyhole size={18} />Lock Card Nest now</button>
    </section>
    <section className="panel form-stack">
      <p className="eyebrow">CHANGE PIN</p>
      <h2>Update this browser’s PIN</h2>
      <label>Current PIN<input autoComplete="off" inputMode="numeric" maxLength={6} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/gu, '').slice(0, 6))} type="password" value={currentPin} /></label>
      <label>New six-digit PIN<input autoComplete="off" inputMode="numeric" maxLength={6} onChange={(event) => setNewPin(event.target.value.replace(/\D/gu, '').slice(0, 6))} type="password" value={newPin} /></label>
      <label>Confirm new PIN<input autoComplete="off" inputMode="numeric" maxLength={6} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/gu, '').slice(0, 6))} type="password" value={confirmPin} /></label>
      <button aria-busy={busy} className="button button-primary" disabled={busy || currentPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6} onClick={() => void changePin()}>{busy ? <><LoaderCircle aria-hidden className="spin" size={18} />Changing PIN…</> : 'Change browser PIN'}</button>
      <p className="form-help">Changing or resetting the PIN immediately invalidates every active unlock session for this account.</p>
    </section>
  </div>;
}
