import { ContactsWorkspace } from '@/components/contacts-workspace';
import { getWebContacts } from '@/lib/contacts';

type Params = Promise<{ q?: string }>;
export default async function ContactsPage({ searchParams }: { searchParams: Params }) { const params = await searchParams; return <ContactsWorkspace contacts={await getWebContacts()} initialQuery={params.q ?? ''} />; }
