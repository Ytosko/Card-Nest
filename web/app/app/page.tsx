import { ContactRound, ScanLine, Search, Star } from 'lucide-react';
import Link from 'next/link';

import { contactName, getWebContacts } from '@/lib/contacts';

export default async function AppOverviewPage() {
  const contacts = await getWebContacts(); const favorites = contacts.filter((item) => item.is_favorite);
  return <section className="workspace-page"><header className="workspace-header"><div><p className="eyebrow">CARD NEST WORKSPACE</p><h1>Your contact library</h1><p className="muted">Everything you scan on mobile and web stays together.</p></div><Link className="button button-primary" href="/app/scan"><ScanLine size={18} />Scan a card</Link></header>
    <div className="metric-grid"><Link href="/app/contacts"><ContactRound /><strong>{contacts.length}</strong><span>Contacts</span></Link><Link href="/app/contacts"><Star /><strong>{favorites.length}</strong><span>Favorites</span></Link><Link href="/app/search"><Search /><strong>Instant</strong><span>Cloud search</span></Link></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">RECENTLY UPDATED</p><h2>Pick up where you left off</h2></div><Link href="/app/contacts">View all</Link></div>{contacts.slice(0, 6).map((contact) => <Link className="recent-contact" href={`/app/contacts/${contact.id}`} key={contact.id}><div className="contact-avatar">{contactName(contact).slice(0, 1).toUpperCase()}</div><div><strong>{contactName(contact)}</strong><span>{contact.company || contact.primary_email || 'Saved contact'}</span></div><time>{new Date(contact.updated_at).toLocaleDateString()}</time></Link>)}{!contacts.length ? <div className="empty-inline"><p>Your library is ready for its first card.</p><Link className="text-link" href="/app/scan">Scan or upload one now</Link></div> : null}</section>
      <aside className="panel quick-panel"><p className="eyebrow">QUICK START</p><h2>From card to contact</h2><ol><li><span>1</span>Upload or photograph the front</li><li><span>2</span>Add the back when it carries more details</li><li><span>3</span>Review AI extraction before saving</li></ol><Link className="button button-secondary" href="/app/settings/ai">Configure AI provider</Link></aside></div>
  </section>;
}
