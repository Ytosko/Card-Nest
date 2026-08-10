import { createHash } from 'node:crypto';

import { type WebContact } from './contact-model';
import { requireWebUser } from './supabase/server';

export async function getWebContacts() {
  const { supabase, user } = await requireWebUser();
  if (!user) return [] as WebContact[];
  const { data, error } = await supabase
    .from('cards')
    .select('*, card_emails(id,email,label,is_primary), card_phone_numbers(id,phone_number,label,service,service_label,is_primary), card_websites(id,url,label,is_primary), card_addresses(id,label,address_line_1,address_line_2,city,state_region,postal_code,country,is_primary), card_images(id,side,storage_path,mime_type), card_tags(tags(id,name,color))')
    .in('status', ['ready', 'review'])
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) throw new Error('Card Nest could not load your contacts.');

  return await Promise.all((data ?? []).map(async (card) => {
    let avatarUrl: string | null = null;
    if (card.contact_photo_path) {
      const { data: signed } = await supabase.storage.from('contact-photos').createSignedUrl(card.contact_photo_path, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    } else if (card.primary_email) {
      const hash = createHash('md5').update(card.primary_email.trim().toLowerCase()).digest('hex');
      avatarUrl = `https://www.gravatar.com/avatar/${hash}?d=404&s=160`;
    }
    return { ...card, avatar_url: avatarUrl } as WebContact;
  }));
}

export async function getWebContact(id: string) {
  const contacts = await getWebContacts();
  return contacts.find((contact) => contact.id === id) ?? null;
}

export { contactName, type WebContact } from './contact-model';
