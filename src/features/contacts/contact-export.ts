import * as Contacts from 'expo-contacts';

import type { CardWithRelations } from '@/src/features/cards/card-service';
import type { Card } from '@/src/types/database.helpers';

function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

function normalizeEmail(email?: string | null): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export type NativeContactMatch = {
  isMatched: boolean;
  nativeContactId?: string;
};

export async function checkNativeContactMatch(card: Card | CardWithRelations): Promise<NativeContactMatch> {
  try {
    const permission = await Contacts.getPermissionsAsync();
    if (!permission.granted) return { isMatched: false };

    const cardEmail = normalizeEmail(card.primary_email);
    const cardPhone = normalizePhone(card.primary_phone);

    if (!cardEmail && !cardPhone) return { isMatched: false };

    const { data: nativeContacts } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      pageSize: 500,
    });

    if (!nativeContacts || nativeContacts.length === 0) return { isMatched: false };

    for (const native of nativeContacts) {
      if (cardEmail && native.emails) {
        for (const e of native.emails) {
          if (e.email && normalizeEmail(e.email) === cardEmail) {
            return { isMatched: true, nativeContactId: native.id };
          }
        }
      }

      if (cardPhone && native.phoneNumbers) {
        for (const p of native.phoneNumbers) {
          if (p.number && normalizePhone(p.number) === cardPhone) {
            return { isMatched: true, nativeContactId: native.id };
          }
        }
      }
    }
  } catch {
    // Fail silently on permission/platform limitation
  }

  return { isMatched: false };
}

export async function exportCardToContacts(card: Card | CardWithRelations) {
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
    addresses: address
      ? [
          {
            street: [card.address_line_1, card.address_line_2].filter(Boolean).join(' '),
            city: card.city ?? undefined,
            region: card.state_region ?? undefined,
            postalCode: card.postal_code ?? undefined,
            country: card.country ?? undefined,
            label: 'work',
          },
        ]
      : undefined,
    urlAddresses: card.website ? [{ url: card.website, label: 'work' }] : undefined,
  });

  return contactId;
}
