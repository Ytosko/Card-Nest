'use client';

import { CheckCircle2, KeyRound, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/feedback';

type Provider = 'openai' | 'gemini';
type CredentialStatus = Record<string, { hasKey: boolean; keySuffix: string; updatedAt: string }>;

export function AiSettings({ initialProvider, initialModel }: { initialProvider: Provider; initialModel: string }) {
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [model, setModel] = useState(initialModel);
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<CredentialStatus>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function status() {
    const response = await fetch('/api/app/ai', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      setCredentials(data.credentials ?? {});
    }
  }

  useEffect(() => {
    let active = true;
    void fetch('/api/app/ai', { cache: 'no-store' }).then(async (response) => {
      if (response.ok && active) {
        const data = await response.json();
        if (active) setCredentials(data.credentials ?? {});
      }
    });
    return () => { active = false; };
  }, []);

  async function loadModels() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/app/ai?action=models&provider=${provider}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Model discovery failed.');
      setModels(data.models ?? []);
      if (!model && data.models?.[0]) setModel(data.models[0]);
      setMessage(`${data.models?.length ?? 0} available models loaded directly from ${provider === 'openai' ? 'OpenAI' : 'Gemini'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Model discovery failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveKey(testOnly = false) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/app/ai${testOnly ? '?action=test' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Provider key was rejected.');
      setMessage(testOnly ? 'Provider key is valid.' : `Encrypted ${provider === 'openai' ? 'OpenAI' : 'Gemini'} key saved.`);
      if (!testOnly) {
        setApiKey('');
        await status();
        await loadModels();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Provider request failed.');
    } finally {
      setBusy(false);
    }
  }

  async function savePreferences() {
    setBusy(true);
    const response = await fetch('/api/app/ai?action=preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model }),
    });
    const data = await response.json();
    setMessage(response.ok ? 'AI provider and model saved.' : data.error ?? 'Could not save preferences.');
    setBusy(false);
  }

  async function removeKey() {
    if (busy) return;
    setBusy(true);
    setRemoveError(null);
    try {
      const response = await fetch(`/api/app/ai?provider=${provider}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Card Nest could not remove the provider key.');
      setMessage('Encrypted provider key removed.');
      await status();
      setModels([]);
      setRemoveDialogOpen(false);
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : 'Card Nest could not remove the provider key.');
    } finally {
      setBusy(false);
    }
  }

  const saved = credentials[provider];

  return <div className="settings-stack">
    {message ? <div className="notice" role="status">{message}</div> : null}
    <section className="panel form-stack">
      <p className="eyebrow">PROVIDER</p><h2>Choose your AI</h2>
      <div className="provider-toggle"><button className={provider === 'gemini' ? 'active' : ''} onClick={() => { setProvider('gemini'); setModels([]); }}>Google Gemini</button><button className={provider === 'openai' ? 'active' : ''} onClick={() => { setProvider('openai'); setModels([]); }}>OpenAI</button></div>
      {saved ? <div className="credential-status"><CheckCircle2 /><div><strong>Encrypted key ending in {saved.keySuffix}</strong><span>Decrypted only inside the extraction Edge Function</span></div></div> : <div className="credential-status muted-status"><KeyRound /><div><strong>No saved key</strong><span>Add your own provider credential to extract card details.</span></div></div>}
      <label>Provider API key<input autoComplete="off" onChange={(event) => setApiKey(event.target.value)} placeholder={saved ? 'Enter a new key to replace the saved one' : 'Paste your provider API key'} type="password" value={apiKey} /></label>
      <div className="button-row"><button className="button button-secondary" disabled={busy || !apiKey} onClick={() => void saveKey(true)}>Test key</button><button className="button button-primary" disabled={busy || !apiKey} onClick={() => void saveKey(false)}>Encrypt and save</button>{saved ? <button className="button button-danger" disabled={busy} onClick={() => { setRemoveError(null); setRemoveDialogOpen(true); }}><Trash2 size={17} />Remove</button> : null}</div>
    </section>
    <section className="panel form-stack">
      <p className="eyebrow">MODEL</p><h2>Dynamic model selection</h2><p className="muted">Card Nest loads the provider&apos;s current model catalog instead of relying on a hard-coded canonical list.</p>
      <button className="button button-secondary" disabled={busy || !saved} onClick={() => void loadModels()}><RefreshCw size={17} />Refresh models</button>
      <label>Selected model<select onChange={(event) => setModel(event.target.value)} value={model}>{model && !models.includes(model) ? <option value={model}>{model}</option> : null}{models.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <button className="button button-primary" disabled={busy || !model} onClick={() => void savePreferences()}>Save AI preferences</button>
    </section>
    <ConfirmDialog busy={busy} confirmLabel="Remove encrypted key" description={`The encrypted ${provider === 'openai' ? 'OpenAI' : 'Gemini'} credential will be removed from Card Nest. You can add another key at any time.`} error={removeError} onCancel={() => setRemoveDialogOpen(false)} onConfirm={() => void removeKey()} open={removeDialogOpen} progressLabel="Removing…" title="Remove provider key?" />
  </div>;
}
