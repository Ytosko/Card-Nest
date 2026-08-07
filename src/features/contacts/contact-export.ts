import * as Contacts from 'expo-contacts';

import type { Card } from '@/src/types/database.helpers';

export async function exportCardToContacts(card: Card) {
  const permission = await Contacts.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Contact permission is needed to save this person to your device.');

  const address = [card.address_line_1, card.address_line_2, card.city, card.state_region, card.postal_code, card.country]
    .filter(Boolean)
    .join(', ');
  const contactId = await Contacts.addContactAsync({
    contactType: Contacts.ContactTypes.Person,
    name: card.display_name ?? card.company ?? 'Card Nest contact',
    firstName: card.first_name ?? undefined,
    middleName: card.middle_name ?? undefined,
    lastName: card.last_name ?? undefined,
    company: card.company ?? undefined,
    jobTitle: card.job_title ?? undefined,
    note: card.notes ?? undefined,
    emails: card.primary_email ? [{ email: card.primary_email, label: 'work', isPrimary: true }] : undefined,
    phoneNumbers: card.primary_phone ? [{ number: card.primary_phone, label: 'work', isPrimary: true }] : undefined,
    addresses: address ? [{ street: [card.address_line_1, card.address_line_2].filter(Boolean).join(' '), city: card.city ?? undefined, region: card.state_region ?? undefined, postalCode: card.postal_code ?? undefined, country: card.country ?? undefined, label: 'work' }] : undefined,
    urlAddresses: card.website ? [{ url: card.website, label: 'work' }] : undefined,
  });
  return contactId;
}
