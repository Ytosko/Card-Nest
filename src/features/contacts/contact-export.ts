import * as Contacts from 'expo-contacts';
import { File, Paths } from 'expo-file-system';

import { getSignedContactPhotoUrl, type CardWithRelations } from '@/src/features/cards/card-service';
import type { Card } from '@/src/types/database.helpers';

import { buildNativeContact, cardEmails, cardPhones } from './native-contact-adapter';

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

async function downloadContactPhoto(card: Card | CardWithRelations): Promise<File | null> {
  if (!card.contact_photo_path) return null;
  const signedUrl = await getSignedContactPhotoUrl(card.contact_photo_path);
  if (!signedUrl) return null;

  const destination = new File(Paths.cache, `card-nest-contact-export-${card.id}.jpg`);
  try {
    await File.downloadFileAsync(signedUrl, destination, { idempotent: true });
    return destination;
  } catch {
    // A photo download failure must not discard the rest of a useful contact. The native
    // payload remains valid and complete apart from the unavailable optional image.
    if (destination.exists) destination.delete();
    return null;
  }
}

export async function checkNativeContactMatch(card: Card | CardWithRelations): Promise<NativeContactMatch> {
  try {
    const permission = await Contacts.getPermissionsAsync();
    if (!permission.granted) return { isMatched: false };

    // Every phone/email on the card counts for matching — not just the primary values.
    const emailSet = new Set(cardEmails(card).map((email) => normalizeEmail(email.email)).filter(Boolean));
    const phoneSet = new Set(cardPhones(card).map((phone) => normalizePhone(phone.phone_number)).filter(Boolean));

    if (emailSet.size === 0 && phoneSet.size === 0) return { isMatched: false };

    const { data: nativeContacts } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      pageSize: 500,
    });

    if (!nativeContacts || nativeContacts.length === 0) return { isMatched: false };

    for (const native of nativeContacts) {
      if (emailSet.size > 0 && native.emails) {
        for (const email of native.emails) {
          if (email.email && emailSet.has(normalizeEmail(email.email))) {
            return { isMatched: true, nativeContactId: native.id };
          }
        }
      }

      if (phoneSet.size > 0 && native.phoneNumbers) {
        for (const phone of native.phoneNumbers) {
          if (phone.number && phoneSet.has(normalizePhone(phone.number))) {
            return { isMatched: true, nativeContactId: native.id };
          }
        }
      }
    }
  } catch {
    // Matching is best-effort; denied permissions and platform limitations should not
    // prevent Card Nest from showing the contact.
  }

  return { isMatched: false };
}

export async function exportCardToContacts(card: Card | CardWithRelations): Promise<string> {
  const permission = await Contacts.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Contact permission is needed to save this person to your device.');

  const photo = await downloadContactPhoto(card);
  try {
    return await Contacts.addContactAsync(buildNativeContact(card, { photoUri: photo?.uri }));
  } finally {
    if (photo?.exists) photo.delete();
  }
}
