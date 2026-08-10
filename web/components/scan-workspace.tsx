'use client';
/* eslint-disable @next/next/no-img-element -- local data URLs must remain local and bypass image optimization */

import { Camera, ImagePlus, LoaderCircle, RotateCcw, Sparkles, UploadCloud, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/feedback';
import { startCardNestNavigation } from '@/components/navigation-progress';

type Side = 'front' | 'back';
type Prepared = { side: Side; name: string; original: string; ai: string };
type ExtractionMeta = { provider?: string; model?: string };
type Result = {
  documentClassification?: { result: 'VALID_CARD' | 'UNCERTAIN_CARD' | 'NOT_A_CARD'; confidence: number; reason: string };
  displayName: string; firstName: string; middleName: string; lastName: string;
  company: string; jobTitle: string; department: string;
  emails: { email: string; label: string; isPrimary: boolean }[];
  phones: { number: string; label: string; service: string; serviceLabel: string; isPrimary: boolean }[];
  websites: string[]; addressLine1: string; addressLine2: string; city: string;
  stateRegion: string; postalCode: string; country: string; notes: string;
  rawText: string; confidence: number;
};

function read(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
  });
}

async function resize(dataUrl: string) {
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = dataUrl; });
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.84);
}

export function ScanWorkspace() {
  const router = useRouter();
  const [files, setFiles] = useState<Partial<Record<Side, Prepared>>>({});
  const [result, setResult] = useState<Result | null>(null); const [meta, setMeta] = useState<ExtractionMeta>({});
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false); const [cameraSide, setCameraSide] = useState<Side | null>(null);
  const frontRef = useRef<HTMLInputElement>(null); const backRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraSide(null);
  }, []);
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  async function addFile(file: File, side: Side) {
    setMessage(null);
    if (!file.type.startsWith('image/')) return setMessage('Choose a JPG, PNG, HEIC, or WebP image.');
    if (file.size > 15 * 1024 * 1024) return setMessage('Each image must be smaller than 15 MB.');
    try {
      const original = await read(file); const ai = await resize(original);
      setFiles((current) => ({ ...current, [side]: { side, name: file.name, original, ai } })); setResult(null); setMeta({});
    } catch { setMessage('This browser could not decode that image. Try JPG, PNG, or WebP.'); }
  }

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'));
      if (file) void addFile(file, files.front ? 'back' : 'front');
    };
    window.addEventListener('paste', paste); return () => window.removeEventListener('paste', paste);
  }, [files.front]);

  async function startCamera(side: Side) {
    setMessage(null);
    if (!navigator.mediaDevices?.getUserMedia) return setMessage('Live camera capture is not available in this browser. You can still upload a photo.');
    try {
      stopCamera(); setCameraSide(side);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play(); } });
    } catch { stopCamera(); setMessage('Camera access was denied or unavailable. Allow camera access, or upload an image instead.'); }
  }

  async function captureCamera() {
    const video = videoRef.current; if (!video || !cameraSide || !video.videoWidth) return;
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const original = canvas.toDataURL('image/jpeg', 0.94); const ai = await resize(original); const side = cameraSide;
    setFiles((current) => ({ ...current, [side]: { side, name: `${side}-camera.jpg`, original, ai } }));
    setResult(null); setMeta({}); stopCamera();
  }

  async function extract() {
    const images = [files.front?.ai, files.back?.ai].filter(Boolean);
    if (!images.length) return setMessage('Add the front of a business card first.');
    setBusy(true); setMessage(null);
    try {
      const response = await fetch('/api/app/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images }) });
      const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.message ?? 'AI extraction failed.');
      const classification = data.result?.documentClassification;
      if (classification?.result === 'NOT_A_CARD') {
        setMessage("This doesn't look like a contact card. We couldn't find enough contact information in this image.");
        setResult(null);
        setMeta({});
        return;
      }
      if (classification?.result === 'UNCERTAIN_CARD') {
        setMessage("Not sure this is a contact card. We found some contact information, but this image doesn't clearly look like a business or contact card.");
      }
      setResult(data.result); setMeta({ provider: data.provider, model: data.model });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'AI extraction failed.'); }
    finally { setBusy(false); }
  }

  async function save(allowDuplicate = false) {
    if (!result) return; setBusy(true); setMessage(null);
    try {
      const response = await fetch('/api/app/contacts/from-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result, provider: meta.provider, model: meta.model, originals: [files.front, files.back].filter(Boolean).map((item) => ({ side: item!.side, data: item!.original })), allowDuplicate }) });
      const data = await response.json();
      if (response.status === 409 && data.duplicate) {
        setBusy(false);
        setDuplicateName(data.duplicate.display_name || 'A contact');
        return;
      }
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Contact save failed.');
      startCardNestNavigation(); router.push(`/app/contacts/${data.id}?saved=true`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Contact save failed.'); }
    finally { setBusy(false); }
  }

  function update<K extends keyof Result>(key: K, value: Result[K]) { setResult((current) => current ? { ...current, [key]: value } : current); }

  return <section className="workspace-page">
    <header className="workspace-header"><div><p className="eyebrow">WEB CAPTURE</p><h1>Scan a business card</h1><p className="muted">Upload, drag and drop, paste, or use your device camera. Add the back when it contains more details.</p></div></header>
    {message ? <div className="notice" role="alert">{message}</div> : null}
    {cameraSide ? <section className="panel camera-panel" aria-label={`Live camera for card ${cameraSide}`}><div className="panel-heading"><div><p className="eyebrow">LIVE CAMERA</p><h2>Photograph the card {cameraSide}</h2></div><button aria-label="Close camera" className="icon-button" onClick={stopCamera} type="button"><X /></button></div><video autoPlay className="live-camera" muted playsInline ref={videoRef} /><button className="button button-primary full-button" onClick={() => void captureCamera()} type="button"><Camera />Capture {cameraSide}</button></section> : null}
    <div className="scan-grid"><section className="panel"><div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void addFile(file, files.front ? 'back' : 'front'); }}><UploadCloud /><h2>Drop a card image here</h2><p>or choose front/back below · paste also works</p></div>
      <div className="capture-columns">{(['front', 'back'] as Side[]).map((side) => { const item = files[side]; const inputRef = side === 'front' ? frontRef : backRef; return <div className="capture-slot" key={side}><div className="capture-preview">{item ? <img alt={`${side} of business card`} src={item.original} /> : <ImagePlus />}</div><strong>{side === 'front' ? 'Front' : 'Back (optional)'}</strong><input accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void addFile(file, side); }} ref={inputRef} type="file" /><div className="capture-actions"><button className="button button-secondary" onClick={() => inputRef.current?.click()} type="button"><ImagePlus size={17} />{item ? 'Replace' : 'Upload'}</button><button className="button button-secondary" onClick={() => void startCamera(side)} type="button"><Camera size={17} />Camera</button></div></div>; })}</div>
      <button className="button button-primary full-button" disabled={busy || !files.front} onClick={() => void extract()} type="button">{busy ? <LoaderCircle className="spin" /> : <Sparkles />}Extract contact details</button></section>
      {result ? <section className="panel review-panel"><div className="panel-heading"><div><p className="eyebrow">REVIEW EXTRACTION</p><h2>Correct before saving</h2></div><button aria-label="Start over" className="icon-button" onClick={() => { setResult(null); setFiles({}); setMeta({}); }} type="button"><RotateCcw /></button></div><div className="field-grid"><label className="span-2">Display name<input value={result.displayName} onChange={(event) => update('displayName', event.target.value)} /></label><label>First name<input value={result.firstName} onChange={(event) => update('firstName', event.target.value)} /></label><label>Last name<input value={result.lastName} onChange={(event) => update('lastName', event.target.value)} /></label><label>Company<input value={result.company} onChange={(event) => update('company', event.target.value)} /></label><label>Job title<input value={result.jobTitle} onChange={(event) => update('jobTitle', event.target.value)} /></label><label className="span-2">Emails<textarea rows={3} value={result.emails.map((item) => item.email).join('\n')} onChange={(event) => update('emails', event.target.value.split(/\r?\n/u).filter(Boolean).map((email, index) => ({ email, label: 'Work', isPrimary: index === 0 })))} /></label><label className="span-2">Phones<textarea rows={3} value={result.phones.map((item) => item.number).join('\n')} onChange={(event) => update('phones', event.target.value.split(/\r?\n/u).filter(Boolean).map((number, index) => ({ number, label: 'Mobile', service: '', serviceLabel: '', isPrimary: index === 0 })))} /></label><label className="span-2">Websites<textarea rows={2} value={result.websites.join('\n')} onChange={(event) => update('websites', event.target.value.split(/\r?\n/u).filter(Boolean))} /></label><label className="span-2">Address<input value={result.addressLine1} onChange={(event) => update('addressLine1', event.target.value)} /></label><label>City<input value={result.city} onChange={(event) => update('city', event.target.value)} /></label><label>Country<input value={result.country} onChange={(event) => update('country', event.target.value)} /></label><label className="span-2">Notes<textarea rows={3} value={result.notes} onChange={(event) => update('notes', event.target.value)} /></label></div><button className="button button-primary full-button" disabled={busy} onClick={() => void save()} type="button">Save to Card Nest</button></section> : <aside className="panel scan-help"><p className="eyebrow">PRIVACY BOUNDARY</p><h2>Your key stays server-side</h2><p>The browser sends prepared card images to Card Nest’s authenticated Edge Function. Your encrypted provider key is decrypted only in trusted server memory and is never returned to this page.</p><p>Original card images are retained privately in your cloud library after you approve the extracted details.</p></aside>}
    </div>
    <ConfirmDialog busy={busy} confirmLabel="Save another copy" danger={false} description={`${duplicateName ?? 'A contact'} already has the same primary email or phone. Continue only if this is a separate contact.`} eyebrow="POSSIBLE DUPLICATE" onCancel={() => setDuplicateName(null)} onConfirm={() => { setDuplicateName(null); void save(true); }} open={Boolean(duplicateName)} progressLabel="Saving contact…" title="Save a duplicate contact?" />
  </section>;
}
