import { BrainCircuit, ChevronRight, ShieldCheck, UserRound } from 'lucide-react';
import Link from 'next/link';

const cards = [
  { href: '/app/settings/profile', icon: UserRound, title: 'Profile & account', copy: 'Display name, email, and account details.' },
  { href: '/app/settings/ai', icon: BrainCircuit, title: 'AI provider', copy: 'Encrypted OpenAI or Gemini credentials and model selection.' },
  { href: '/app/settings/security', icon: ShieldCheck, title: 'Security & browser lock', copy: 'Change your browser PIN and automatic lock timing.' },
];
export default function SettingsPage() { return <section className="workspace-page"><header className="workspace-header"><div><p className="eyebrow">CARD NEST PREFERENCES</p><h1>Settings</h1><p className="muted">Manage your account, extraction provider, and this browser.</p></div></header><div className="settings-list">{cards.map(({ href, icon: Icon, title, copy }) => <Link href={href} key={href}><div className="settings-icon"><Icon /></div><div><h2>{title}</h2><p>{copy}</p></div><ChevronRight /></Link>)}</div></section>; }
