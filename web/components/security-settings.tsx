'use client';

import { useEffect, useMemo, useState } from 'react';

import { createWebLockConfig, verifyWebPin, webLockStorageKey, type AutoLockTimeout, type WebLockConfig } from '@/lib/web-lock';

export function SecuritySettings({ userId }: { userId: string }) {
  const key = useMemo(() => webLockStorageKey(userId), [userId]); const [config, setConfig] = useState<WebLockConfig | null>(null);
  const [currentPin, setCurrentPin] = useState(''); const [newPin, setNewPin] = useState(''); const [confirmPin, setConfirmPin] = useState(''); const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setConfig(JSON.parse(localStorage.getItem(key) ?? 'null')); } catch { setConfig(null); }
    });
    return () => cancelAnimationFrame(frame);
  }, [key]);
  function persist(next: WebLockConfig) { localStorage.setItem(key, JSON.stringify(next)); setConfig(next); }
  function setTimeoutValue(timeout: AutoLockTimeout) { if (!config) return; persist({ ...config, timeout }); setMessage('Automatic lock timing updated.'); }
  async function changePin() { setMessage(null); if (!config) return; const verified = await verifyWebPin(currentPin, config); if (!verified.ok) return setMessage('Current browser PIN is not correct.'); if (newPin !== confirmPin) return setMessage('The new PIN entries do not match.'); try { persist(await createWebLockConfig(newPin, config.timeout)); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setMessage('Browser PIN changed.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'PIN change failed.'); } }
  return <div className="settings-stack">{message ? <div className="notice" role="status">{message}</div> : null}<section className="panel"><p className="eyebrow">AUTO-LOCK</p><h2>Lock after inactivity</h2><p className="muted">This setting applies only to this browser. Hidden tabs count as inactive.</p><div className="timeout-grid">{([['immediately','Immediately'],['1m','1 minute'],['5m','5 minutes'],['15m','15 minutes']] as [AutoLockTimeout,string][]).map(([value,label]) => <button className={config?.timeout === value ? 'active' : ''} key={value} onClick={() => setTimeoutValue(value)}>{label}</button>)}</div></section><section className="panel form-stack"><p className="eyebrow">CHANGE PIN</p><h2>Update this browser’s PIN</h2><label>Current PIN<input inputMode="numeric" maxLength={6} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/gu,''))} type="password" value={currentPin} /></label><label>New six-digit PIN<input inputMode="numeric" maxLength={6} onChange={(event) => setNewPin(event.target.value.replace(/\D/gu,''))} type="password" value={newPin} /></label><label>Confirm new PIN<input inputMode="numeric" maxLength={6} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/gu,''))} type="password" value={confirmPin} /></label><button className="button button-primary" disabled={currentPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6} onClick={() => void changePin()}>Change browser PIN</button><p className="form-help">Forgot it? Lock Card Nest, choose “Forgot PIN,” and complete fresh account re-authentication.</p></section></div>;
}
