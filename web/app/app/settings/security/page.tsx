import { SecuritySettings } from '@/components/security-settings';
import { requireWebUser } from '@/lib/supabase/server';

export default async function SecurityPage() { const { user } = await requireWebUser(); return <section className="workspace-page narrow-page"><header className="workspace-header"><div><p className="eyebrow">SECURITY</p><h1>Browser lock</h1><p className="muted">A local PIN is separate from your Card Nest account password. Web never uses biometric or passkey controls.</p></div></header><SecuritySettings userId={user!.id} /></section>; }
