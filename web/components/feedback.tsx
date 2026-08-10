'use client';

import { AlertTriangle, CheckCircle2, LoaderCircle, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export function LoadingSpinner({ size = 18 }: { size?: number }) {
  return <LoaderCircle aria-hidden className="spin" size={size} />;
}

type ConfirmDialogProps = {
  busy: boolean;
  confirmLabel: string;
  danger?: boolean;
  description: string;
  eyebrow?: string;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  progressLabel: string;
  title: string;
};

export function ConfirmDialog({ busy, confirmLabel, danger = true, description, error, eyebrow = 'CONFIRM DELETION', onCancel, onConfirm, open, progressLabel, title }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <dialog aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal="true" className="confirm-dialog" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }} ref={dialogRef}>
    <div aria-busy={busy} className="confirm-dialog-card">
      <div className="confirm-dialog-heading"><span className="confirm-dialog-icon"><AlertTriangle aria-hidden /></span><div><p className="eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2></div><button aria-label="Close confirmation" className="icon-button" disabled={busy} onClick={onCancel} type="button"><X /></button></div>
      <p className="muted" id={descriptionId}>{description}</p>
      {error ? <div className="notice error-notice" role="alert">{error}</div> : null}
      <div className="confirm-dialog-actions"><button autoFocus className="button button-secondary" disabled={busy} onClick={onCancel} type="button">Cancel</button><button aria-busy={busy} className={`button ${danger ? 'button-danger' : 'button-primary'}`} disabled={busy} onClick={onConfirm} type="button">{busy ? <><LoadingSpinner />{progressLabel}</> : confirmLabel}</button></div>
    </div>
  </dialog>;
}

export type ToastDetail = { message: string; tone?: 'success' | 'error' };

export function showCardNestToast(detail: ToastDetail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<ToastDetail>('cardnest:web-toast', { detail }));
}

export function ToastRegion() {
  const [toast, setToast] = useState<(ToastDetail & { id: number }) | null>(null);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      if (detail?.message) setToast({ ...detail, id: Date.now() });
    };
    window.addEventListener('cardnest:web-toast', onToast);
    return () => window.removeEventListener('cardnest:web-toast', onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return <div aria-atomic="true" aria-live="polite" className={`app-toast app-toast-${toast.tone ?? 'success'}`} role="status">{toast.tone === 'error' ? <AlertTriangle aria-hidden /> : <CheckCircle2 aria-hidden />}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToast(null)} type="button"><X aria-hidden /></button></div>;
}
