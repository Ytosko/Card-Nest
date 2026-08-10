'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { deleteContacts } from '@/app/app/actions';
import { ConfirmDialog, showCardNestToast } from '@/components/feedback';
import { startCardNestNavigation } from '@/components/navigation-progress';

export function ContactDeletePanel({ contactId, contactName }: { contactId: string; contactName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteContacts([contactId]);
      if (!result.succeededIds.includes(contactId)) throw new Error('This contact could not be deleted. Refresh and try again.');
      setOpen(false);
      showCardNestToast({ message: `${contactName} deleted` });
      startCardNestNavigation();
      router.push('/app/contacts');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Card Nest could not delete this contact.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel danger-zone">
    <h2>Delete contact</h2>
    <p>This permanently removes the contact and its private images.</p>
    <button className="button button-danger" onClick={() => { setError(null); setOpen(true); }} type="button"><Trash2 aria-hidden size={17} />Delete contact</button>
    <ConfirmDialog busy={busy} confirmLabel="Delete contact" description="This permanently removes the contact, its scanned card images, and its private contact photo. This cannot be undone." error={error} onCancel={() => setOpen(false)} onConfirm={() => void confirmDelete()} open={open} progressLabel="Deleting…" title={`Delete ${contactName}?`} />
  </section>;
}
