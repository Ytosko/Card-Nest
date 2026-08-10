'use client';
/* eslint-disable @next/next/no-img-element -- signed/private avatar URLs are intentionally rendered directly */

import { Download, Plus, Search, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { deleteContacts, setContactsFavorite, toggleContactFavorite } from '@/app/app/actions';
import { ConfirmDialog, LoadingSpinner, showCardNestToast } from '@/components/feedback';
import { contactName, type WebContact } from '@/lib/contact-model';

type BulkOperation = 'delete' | 'favorite' | 'unfavorite' | null;

export function ContactsWorkspace({ contacts, initialQuery = '' }: { contacts: WebContact[]; initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [operation, setOperation] = useState<BulkOperation>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rowPending, setRowPending] = useState<string | null>(null);
  const visibleContacts = useMemo(() => contacts.filter((contact) => !deletedIds.has(contact.id)), [contacts, deletedIds]);
  const filtered = useMemo(() => visibleContacts.filter((contact) => {
    if (favoritesOnly && !contact.is_favorite) return false;
    const haystack = [contactName(contact), contact.company, contact.job_title, contact.primary_email, contact.primary_phone, contact.city, contact.country, contact.notes, contact.raw_extracted_text, ...contact.card_emails.map((item) => item.email), ...contact.card_phone_numbers.map((item) => item.phone_number), ...contact.card_tags.map((item) => item.tags?.name)].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [favoritesOnly, query, visibleContacts]);
  const selectedCount = selected.size;
  const busy = operation !== null;

  async function confirmBulkDelete() {
    if (!selectedCount || busy) return;
    const ids = [...selected];
    setOperation('delete');
    setDeleteError(null);
    try {
      const result = await deleteContacts(ids);
      if (result.succeededIds.length) {
        setDeletedIds((current) => new Set([...current, ...result.succeededIds]));
      }
      setSelected(new Set(result.failedIds));
      setDeleteDialogOpen(false);
      if (result.failedIds.length) {
        showCardNestToast({ message: `${result.succeededIds.length} deleted; ${result.failedIds.length} could not be deleted.`, tone: 'error' });
      } else {
        showCardNestToast({ message: `${result.succeededIds.length} contact${result.succeededIds.length === 1 ? '' : 's'} deleted` });
      }
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Card Nest could not delete the selected contacts.');
    } finally {
      setOperation(null);
    }
  }

  async function bulkFavorite(favorite: boolean) {
    if (!selectedCount || busy) return;
    const ids = [...selected];
    setOperation(favorite ? 'favorite' : 'unfavorite');
    try {
      await setContactsFavorite(ids, favorite);
      setSelected(new Set());
      showCardNestToast({ message: `${ids.length} contact${ids.length === 1 ? '' : 's'} ${favorite ? 'favorited' : 'unfavorited'}` });
      router.refresh();
    } catch {
      showCardNestToast({ message: `Card Nest could not ${favorite ? 'favorite' : 'unfavorite'} the selected contacts.`, tone: 'error' });
    } finally {
      setOperation(null);
    }
  }

  async function toggleFavorite(contact: WebContact) {
    if (rowPending) return;
    setRowPending(contact.id);
    try {
      await toggleContactFavorite(contact.id, !contact.is_favorite);
      router.refresh();
    } catch {
      showCardNestToast({ message: 'Card Nest could not update that favorite.', tone: 'error' });
    } finally {
      setRowPending(null);
    }
  }

  return <section className="workspace-page">
    <header className="workspace-header"><div><p className="eyebrow">CLOUD CONTACT LIBRARY</p><h1>Contacts</h1><p className="muted">{visibleContacts.length} saved {visibleContacts.length === 1 ? 'contact' : 'contacts'}</p></div><Link className="button button-primary" href="/app/contacts/new"><Plus size={18} />Add contact</Link></header>
    <div className="contact-toolbar"><label className="search-field"><Search aria-hidden size={20} /><span className="sr-only">Search contacts</span><input aria-label="Search contacts" onChange={(event) => setQuery(event.target.value)} placeholder="Search names, companies, phones, emails, tags…" value={query} /></label><button className={`filter-button ${favoritesOnly ? 'active' : ''}`} onClick={() => setFavoritesOnly((value) => !value)}><Star size={18} fill={favoritesOnly ? 'currentColor' : 'none'} />Favorites</button></div>
    {selectedCount ? <div aria-busy={busy} className="selection-bar"><strong>{selectedCount} selected</strong><button className="button button-secondary small" disabled={busy} onClick={() => void bulkFavorite(true)}>{operation === 'favorite' ? <><LoadingSpinner size={16} />Updating {selectedCount}…</> : <><Star size={16} />Favorite</>}</button><button className="button button-secondary small" disabled={busy} onClick={() => void bulkFavorite(false)}>{operation === 'unfavorite' ? <><LoadingSpinner size={16} />Updating {selectedCount}…</> : 'Unfavorite'}</button><a aria-disabled={busy} className={`button button-secondary small ${busy ? 'disabled-link' : ''}`} href={`/api/app/export?format=vcard&ids=${encodeURIComponent([...selected].join(','))}`} onClick={(event) => { if (busy) event.preventDefault(); }} tabIndex={busy ? -1 : undefined}><Download size={16} />vCard</a><a aria-disabled={busy} className={`button button-secondary small ${busy ? 'disabled-link' : ''}`} href={`/api/app/export?format=csv&ids=${encodeURIComponent([...selected].join(','))}`} onClick={(event) => { if (busy) event.preventDefault(); }} tabIndex={busy ? -1 : undefined}><Download size={16} />CSV</a><button className="button button-danger small" disabled={busy} onClick={() => { setDeleteError(null); setDeleteDialogOpen(true); }}><Trash2 size={16} />Delete</button></div> : null}
    {filtered.length ? <div className="contact-list">{filtered.map((contact) => {
      const checked = selected.has(contact.id);
      return <article className={`contact-row ${checked ? 'selected' : ''}`} key={contact.id}>
        <input aria-label={`Select ${contactName(contact)}`} checked={checked} disabled={busy} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(contact.id)) next.delete(contact.id); else next.add(contact.id); return next; })} type="checkbox" />
        <Link className="contact-main" href={`/app/contacts/${contact.id}`}><div className="contact-avatar">{contact.avatar_url ? <img alt="" src={contact.avatar_url} /> : contactName(contact).slice(0, 1).toUpperCase()}</div><div><h2>{contactName(contact)}</h2><p>{[contact.job_title, contact.company].filter(Boolean).join(' · ') || 'Contact'}</p></div></Link>
        <div className="contact-meta"><span>{contact.primary_email || contact.primary_phone || 'No primary contact detail'}</span><span>{new Date(contact.updated_at).toLocaleDateString()}</span></div>
        <button aria-busy={rowPending === contact.id} aria-label={contact.is_favorite ? `Remove ${contactName(contact)} from favorites` : `Add ${contactName(contact)} to favorites`} className="icon-button" disabled={Boolean(rowPending) || busy} onClick={() => void toggleFavorite(contact)}>{rowPending === contact.id ? <LoadingSpinner /> : <Star fill={contact.is_favorite ? 'currentColor' : 'none'} />}</button>
      </article>;
    })}</div> : <div className="empty-panel"><Search size={36} /><h2>No contacts found</h2><p>Try a different search, clear the Favorites filter, or add your first contact.</p><Link className="button button-primary" href="/app/contacts/new">Add contact</Link></div>}
    <ConfirmDialog busy={operation === 'delete'} confirmLabel={`Delete ${selectedCount} contact${selectedCount === 1 ? '' : 's'}`} description="This permanently removes the selected contacts, their scanned card images, and private contact photos. This cannot be undone." error={deleteError} onCancel={() => setDeleteDialogOpen(false)} onConfirm={() => void confirmBulkDelete()} open={deleteDialogOpen} progressLabel={`Deleting ${selectedCount} contact${selectedCount === 1 ? '' : 's'}…`} title={`Delete ${selectedCount} contact${selectedCount === 1 ? '' : 's'}?`} />
  </section>;
}
