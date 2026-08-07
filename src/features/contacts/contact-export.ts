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

type RelationEmail = { email: string; label: string | null; is_primary: boolean | null };
type RelationPhone = { phone_number: string; label: string | null; is_primary: boolean | null };

function cardEmails(card: Card | CardWithRelations): RelationEmail[] {
  if ('card_emails' in card && Array.isArray(card.card_emails) && card.card_emails.length > 0) {
    return card.card_emails;
  }
  return card.primary_email ? [{ email: card.primary_email, label: 'work', is_primary: true }] : [];
}

function cardPhones(card: Card | CardWithRelations): RelationPhone[] {
  if ('card_phone_numbers' in card && Array.isArray(card.card_phone_numbers) && card.card_phone_numbers.length > 0) {
    return card.card_phone_numbers;
  }
  return card.primary_phone ? [{ phone_number: card.primary_phone, label: 'work', is_primary: true }] : [];
}

export async function checkNativeContactMatch(card: Card | CardWithRelations): Promise<NativeContactMatch> {
  try {
    const permission = await Contacts.getPermissionsAsync();
    if (!permission.granted) return { isMatched: false };

    // Every phone/email on the card counts for matching — not just the primary values.
    const emailSet = new Set(cardEmails(card).map((e) => normalizeEmail(e.email)).filter(Boolean));
    const phoneSet = new Set(cardPhones(card).map((p) => normalizePhone(p.phone_number)).filter(Boolean));

    if (emailSet.size === 0 && phoneSet.size === 0) return { isMatched: false };

    const { data: nativeContacts } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      pageSize: 500,
    });

    if (!nativeContacts || nativeContacts.length === 0) return { isMatched: false };

    for (const native of nativeContacts) {
      if (emailSet.size > 0 && native.emails) {
        for (const e of native.emails) {
          if (e.email && emailSet.has(normalizeEmail(e.email))) {
            return { isMatched: true, nativeContactId: native.id };
          }
        }
      }

      if (phoneSet.size > 0 && native.phoneNumbers) {
        for (const p of native.phoneNumbers) {
          if (p.number && phoneSet.has(normalizePhone(p.number))) {
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
    emails: (() => {
      const emails = cardEmails(card);
      return emails.length
        ? emails.map((e) => ({
            email: e.email,
            label: (e.label || 'work').toLowerCase(),
            isPrimary: Boolean(e.is_primary),
          }))
        : undefined;
    })(),
    phoneNumbers: (() => {
      const phones = cardPhones(card);
      return phones.length
        ? phones.map((p) => ({
            number: p.phone_number,
            label: (p.label || 'work').toLowerCase(),
            isPrimary: Boolean(p.is_primary),
          }))
        : undefined;
    })(),
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
