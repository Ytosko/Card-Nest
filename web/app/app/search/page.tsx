import { Search } from 'lucide-react';
import Link from 'next/link';

import { contactName, getWebContacts } from '@/lib/contacts';

type Params = Promise<{ q?: string }>;
export default async function SearchPage({ searchParams }: { searchParams: Params }) {
  const { q = '' } = await searchParams; const query = q.trim().toLowerCase(); const contacts = await getWebContacts();
  const results = query ? contacts.filter((contact) => [contactName(contact), contact.company, contact.job_title, contact.primary_email, contact.primary_phone, contact.city, contact.country, contact.notes, contact.raw_extracted_text, ...contact.card_tags.map((item) => item.tags?.name)].filter(Boolean).join(' ').toLowerCase().includes(query)) : [];
  return <section className="workspace-page"><header className="workspace-header"><div><p className="eyebrow">FULL LIBRARY SEARCH</p><h1>Find any contact</h1><p className="muted">Search names, companies, printed text, locations, tags, phones, and email addresses.</p></div></header><form className="search-page-form"><Search /><input autoFocus defaultValue={q} name="q" placeholder="Search your Card Nest…" /><button className="button button-primary">Search</button></form>{query ? <div className="panel"><p className="eyebrow">{results.length} RESULTS</p><div className="search-results">{results.map((contact) => <Link href={`/app/contacts/${contact.id}`} key={contact.id}><div className="contact-avatar">{contactName(contact).slice(0, 1)}</div><div><strong>{contactName(contact)}</strong><span>{[contact.job_title, contact.company, contact.primary_email].filter(Boolean).join(' · ')}</span></div></Link>)}{!results.length ? <div className="empty-inline">No contact matched “{q}”.</div> : null}</div></div> : <div className="empty-panel"><Search size={36} /><h2>Search across everything</h2><p>Card Nest indexes both normalized contact fields and the original text extracted from each card.</p></div>}</section>;
}
