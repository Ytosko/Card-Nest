'use client';
/* eslint-disable @next/next/no-img-element -- signed/private avatar URLs are intentionally rendered directly */

import { Download, Plus, Search, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { deleteContacts, setContactsFavorite, toggleContactFavorite } from '@/app/app/actions';
import { contactName, type WebContact } from '@/lib/contact-model';

export function ContactsWorkspace({ contacts, initialQuery = '' }: { contacts: WebContact[]; initialQuery?: string }) {
  const router = useRouter(); const [query, setQuery] = useState(initialQuery); const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => contacts.filter((contact) => {
    if (favoritesOnly && !contact.is_favorite) return false;
    const haystack = [contactName(contact), contact.company, contact.job_title, contact.primary_email, contact.primary_phone, contact.city, contact.country, contact.notes, contact.raw_extracted_text, ...contact.card_emails.map((item) => item.email), ...contact.card_phone_numbers.map((item) => item.phone_number), ...contact.card_tags.map((item) => item.tags?.name)].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [contacts, favoritesOnly, query]);

  function bulkDelete() { if (!selected.size || !confirm(`Permanently delete ${selected.size} selected contact${selected.size === 1 ? '' : 's'} and their private images?`)) return; startTransition(async () => { await deleteContacts([...selected]); setSelected(new Set()); router.refresh(); }); }
  function bulkFavorite(favorite: boolean) { startTransition(async () => { await setContactsFavorite([...selected], favorite); router.refresh(); }); }

  return <section className="workspace-page">
    <header className="workspace-header"><div><p className="eyebrow">CLOUD CONTACT LIBRARY</p><h1>Contacts</h1><p className="muted">{contacts.length} saved {contacts.length === 1 ? 'contact' : 'contacts'}</p></div><Link className="button button-primary" href="/app/contacts/new"><Plus size={18} />Add contact</Link></header>
    <div className="contact-toolbar"><label className="search-field"><Search aria-hidden size={20} /><span className="sr-only">Search contacts</span><input aria-label="Search contacts" onChange={(event) => setQuery(event.target.value)} placeholder="Search names, companies, phones, emails, tags…" value={query} /></label><button className={`filter-button ${favoritesOnly ? 'active' : ''}`} onClick={() => setFavoritesOnly((value) => !value)}><Star size={18} fill={favoritesOnly ? 'currentColor' : 'none'} />Favorites</button></div>
    {selected.size ? <div className="selection-bar"><strong>{selected.size} selected</strong><button className="button button-secondary small" disabled={pending} onClick={() => bulkFavorite(true)}><Star size={16} />Favorite</button><button className="button button-secondary small" disabled={pending} onClick={() => bulkFavorite(false)}>Unfavorite</button><a className="button button-secondary small" href={`/api/app/export?format=vcard&ids=${encodeURIComponent([...selected].join(','))}`}><Download size={16} />vCard</a><a className="button button-secondary small" href={`/api/app/export?format=csv&ids=${encodeURIComponent([...selected].join(','))}`}><Download size={16} />CSV</a><button className="button button-danger small" disabled={pending} onClick={bulkDelete}><Trash2 size={16} />Delete</button></div> : null}
    {filtered.length ? <div className="contact-list">{filtered.map((contact) => {
      const checked = selected.has(contact.id); return <article className={`contact-row ${checked ? 'selected' : ''}`} key={contact.id}>
        <input aria-label={`Select ${contactName(contact)}`} checked={checked} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(contact.id)) next.delete(contact.id); else next.add(contact.id); return next; })} type="checkbox" />
        <Link className="contact-main" href={`/app/contacts/${contact.id}`}><div className="contact-avatar">{contact.avatar_url ? <img alt="" src={contact.avatar_url} /> : contactName(contact).slice(0, 1).toUpperCase()}</div><div><h2>{contactName(contact)}</h2><p>{[contact.job_title, contact.company].filter(Boolean).join(' · ') || 'Contact'}</p></div></Link>
        <div className="contact-meta"><span>{contact.primary_email || contact.primary_phone || 'No primary contact detail'}</span><span>{new Date(contact.updated_at).toLocaleDateString()}</span></div>
        <button aria-label={contact.is_favorite ? `Remove ${contactName(contact)} from favorites` : `Add ${contactName(contact)} to favorites`} className="icon-button" onClick={() => startTransition(async () => { await toggleContactFavorite(contact.id, !contact.is_favorite); router.refresh(); })}><Star fill={contact.is_favorite ? 'currentColor' : 'none'} /></button>
      </article>})}</div> : <div className="empty-panel"><Search size={36} /><h2>No contacts found</h2><p>Try a different search, clear the Favorites filter, or add your first contact.</p><Link className="button button-primary" href="/app/contacts/new">Add contact</Link></div>}
  </section>;
}
