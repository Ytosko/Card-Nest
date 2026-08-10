import * as Contacts from 'expo-contacts';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

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

export type BulkContactExportResult = {
  succeeded: { cardId: string; nativeContactId: string }[];
  failed: { cardId: string; message: string }[];
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

    let pageOffset = 0;
    let hasNextPage = true;
    while (hasNextPage) {
      const page = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
        pageOffset,
        pageSize: 500,
      });

      for (const native of page.data ?? []) {
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

      hasNextPage = Boolean(page.hasNextPage) && page.data.length > 0;
      pageOffset += page.data.length;
    }
  } catch {
    // Matching is best-effort; denied permissions and platform limitations should not
    // prevent Card Nest from showing the contact.
  }

  return { isMatched: false };
}

async function matchingNativeContactIds(card: Card | CardWithRelations): Promise<Set<string>> {
  const emailSet = new Set(cardEmails(card).map((email) => normalizeEmail(email.email)).filter(Boolean));
  const phoneSet = new Set(cardPhones(card).map((phone) => normalizePhone(phone.phone_number)).filter(Boolean));
  const matches = new Set<string>();
  if (emailSet.size === 0 && phoneSet.size === 0) return matches;

  let pageOffset = 0;
  let hasNextPage = true;
  while (hasNextPage) {
    const page = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      pageOffset,
      pageSize: 500,
    });
    for (const native of page.data ?? []) {
      const emailMatch = native.emails?.some(
        (email) => Boolean(email.email) && emailSet.has(normalizeEmail(email.email))
      );
      const phoneMatch = native.phoneNumbers?.some(
        (phone) => Boolean(phone.number) && phoneSet.has(normalizePhone(phone.number))
      );
      if ((emailMatch || phoneMatch) && native.id) matches.add(native.id);
    }
    hasNextPage = Boolean(page.hasNextPage) && page.data.length > 0;
    pageOffset += page.data.length;
  }
  return matches;
}

async function ensureContactPermission(): Promise<void> {
  const permission = await Contacts.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Contact permission is needed to save this person to your device.');
}

async function withNativeContactPayload<T>(
  card: Card | CardWithRelations,
  action: (payload: Contacts.Contact) => Promise<T>
): Promise<T> {
  const photo = await downloadContactPhoto(card);
  try {
    return await action(buildNativeContact(card, { photoUri: photo?.uri }));
  } finally {
    if (photo?.exists) photo.delete();
  }
}

async function findSavedNativeContact(
  card: Card | CardWithRelations,
  previousMatches: ReadonlySet<string>
): Promise<NativeContactMatch> {
  // Some OEM Contacts providers commit asynchronously after their editor closes.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const matches = await matchingNativeContactIds(card);
    const nativeContactId = [...matches].find((id) => !previousMatches.has(id));
    if (nativeContactId) return { isMatched: true, nativeContactId };
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return { isMatched: false };
}

function withAndroidEditorFallbacks(payload: Contacts.Contact): Contacts.Contact {
  if (Platform.OS !== 'android' || !payload.addresses?.length) return payload;

  // Google Contacts on some Android versions drops StructuredPostal rows from the
  // ACTION_INSERT prefill intent. Keep sending the native address structure, and also
  // preserve a concise readable copy in Notes so the editor cannot silently lose it.
  const addressLines = payload.addresses
    .map((address) =>
      [address.street?.replace(/\n+/gu, ', '), address.city, address.region, address.postalCode, address.country]
        .filter(Boolean)
        .join(', ')
    )
    .filter(Boolean)
    .map((address) => `Address: ${address}`);
  if (!addressLines.length) return payload;

  return {
    ...payload,
    note: [payload.note?.trim(), addressLines.join('\n')].filter(Boolean).join('\n\n'),
  };
}

/**
 * Opens the platform contact editor with Card Nest fields prefilled. The OS owns
 * account/container selection and the user explicitly confirms Save.
 */
export async function exportCardToContacts(card: Card | CardWithRelations): Promise<string | null> {
  await ensureContactPermission();
  const previousMatches = await matchingNativeContactIds(card);
  await withNativeContactPayload(card, async (payload) => {
    await Contacts.presentFormAsync(null, withAndroidEditorFallbacks(payload));
  });

  const savedContact = await findSavedNativeContact(card, previousMatches);
  return savedContact.nativeContactId ?? null;
}

/**
 * Bulk export intentionally avoids opening one native editor per contact. Expo's
 * patched Android writer targets the platform-configured default account; iOS uses
 * its normal default-container behavior.
 */
export async function exportCardsToContacts(
  cards: readonly (Card | CardWithRelations)[]
): Promise<BulkContactExportResult> {
  await ensureContactPermission();

  const result: BulkContactExportResult = { succeeded: [], failed: [] };
  for (const card of cards) {
    try {
      const nativeContactId = await withNativeContactPayload(card, (payload) => Contacts.addContactAsync(payload));
      result.succeeded.push({ cardId: card.id, nativeContactId });
    } catch (reason) {
      result.failed.push({
        cardId: card.id,
        message: reason instanceof Error ? reason.message : 'The device could not create this contact.',
      });
    }
  }

  return result;
}
