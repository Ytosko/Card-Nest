import type * as Contacts from 'expo-contacts';

import type { CardWithRelations } from '@/src/features/cards/card-service';
import type { Card } from '@/src/types/database.helpers';

type ExportableCard = Card | CardWithRelations;

type RelationEmail = {
  email: string;
  label: string | null;
  is_primary: boolean | null;
};

type RelationPhone = {
  phone_number: string;
  label: string | null;
  is_primary: boolean | null;
  service?: string | null;
  service_label?: string | null;
};

type RelationWebsite = {
  url: string;
  label: string | null;
  is_primary: boolean | null;
};

type RelationAddress = {
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  label: string | null;
  is_primary: boolean | null;
};

export type NativeContactAdapterOptions = {
  /** Expo Contacts only accepts a local file URI for a native contact image. */
  photoUri?: string | null;
};

function clean(value?: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const result = value.trim();
  return result || undefined;
}

function comparePrimary<T extends { is_primary: boolean | null }>(left: T, right: T): number {
  return Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary));
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = keyFor(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePhoneKey(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function normalizePhoneLabel(label?: string | null): string {
  const normalized = label?.trim().toLowerCase().replace(/[\s_-]+/g, '') ?? '';
  if (normalized === 'home') return 'home';
  if (normalized.includes('fax')) return normalized.includes('home') ? 'faxHome' : 'faxWork';
  if (['work', 'office', 'business', 'direct', 'landline', 'company', 'companymain'].includes(normalized)) {
    return 'work';
  }
  if (['mobile', 'cell', 'cellular', 'personal'].includes(normalized)) return 'mobile';
  return 'other';
}

function normalizeEmailLabel(label?: string | null): string {
  const normalized = label?.trim().toLowerCase() ?? '';
  if (normalized === 'work' || normalized === 'business' || normalized === 'office') return 'work';
  if (normalized === 'personal' || normalized === 'home') return 'personal';
  return 'other';
}

function normalizeAddressLabel(label?: string | null): string {
  const normalized = label?.trim().toLowerCase() ?? '';
  if (normalized === 'home') return 'home';
  if (normalized === 'work' || normalized === 'office' || normalized === 'business') return 'work';
  return 'other';
}

function normalizeWebsiteLabel(label?: string | null): string {
  const normalized = label?.trim().toLowerCase() ?? '';
  if (['work', 'portfolio', 'social', 'home', 'blog', 'profile'].includes(normalized)) return normalized;
  return 'other';
}

function normalizeWebsite(value?: string | null): string | undefined {
  const trimmed = clean(value);
  if (!trimmed || /[\s\u0000-\u001f]/.test(trimmed)) return undefined;

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function serviceTokens(value?: string | null): string[] {
  const trimmed = clean(value);
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  // Service metadata is stored as text. Only extract human-readable primitive tokens;
  // JSON objects and other structured values must never cross the native bridge.
  if (trimmed.startsWith('{')) return [];
  return trimmed.split(/[,;/|]+/).map((entry) => entry.trim()).filter(Boolean);
}

const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  whatsapp: 'WhatsApp',
  imo: 'IMO',
  bkash: 'bKash',
  telegram: 'Telegram',
  viber: 'Viber',
  line: 'LINE',
  wechat: 'WeChat',
  signal: 'Signal',
  messenger: 'Messenger',
  nagad: 'Nagad',
  rocket: 'Rocket',
};

function serviceKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z\d]/g, '');
}

function serviceDisplayName(value: string): string {
  return SERVICE_DISPLAY_NAMES[serviceKey(value)] ?? value;
}

function phoneServices(phone: RelationPhone): string[] {
  const labels = serviceTokens(phone.service_label);
  const identifiers = serviceTokens(phone.service).filter(
    (service) => serviceKey(service) !== 'other' || labels.length === 0
  );
  return uniqueBy([...labels, ...identifiers].map(serviceDisplayName), (service) => serviceKey(service));
}

export function cardEmails(card: ExportableCard): RelationEmail[] {
  const relations =
    'card_emails' in card && Array.isArray(card.card_emails) ? card.card_emails : [];
  const rows = relations.length
    ? relations
    : card.primary_email
      ? [{ email: card.primary_email, label: 'work', is_primary: true }]
      : [];

  return uniqueBy(
    rows
      .map((row) => ({ ...row, email: row.email.trim() }))
      .filter((row) => isValidEmail(row.email))
      .sort(comparePrimary),
    (row) => row.email.toLowerCase()
  );
}

export function cardPhones(card: ExportableCard): RelationPhone[] {
  const relations =
    'card_phone_numbers' in card && Array.isArray(card.card_phone_numbers) ? card.card_phone_numbers : [];
  const rows = relations.length
    ? relations
    : card.primary_phone
      ? [{ phone_number: card.primary_phone, label: 'mobile', is_primary: true }]
      : [];

  return uniqueBy(
    rows
      .map((row) => ({ ...row, phone_number: row.phone_number.trim() }))
      .filter((row) => /\d/.test(row.phone_number))
      .sort(comparePrimary),
    (row) => normalizePhoneKey(row.phone_number)
  );
}

function cardWebsites(card: ExportableCard): RelationWebsite[] {
  const relations =
    'card_websites' in card && Array.isArray(card.card_websites) ? card.card_websites : [];
  const rows: RelationWebsite[] = [...relations];
  if (card.website) {
    rows.push({ url: card.website, label: 'work', is_primary: relations.length === 0 });
  }

  return uniqueBy(
    rows
      .map((row) => ({ ...row, url: normalizeWebsite(row.url) }))
      .filter((row): row is Omit<typeof row, 'url'> & { url: string } => Boolean(row.url))
      .sort(comparePrimary),
    (row) => row.url.toLowerCase().replace(/\/$/, '')
  );
}

function cardAddresses(card: ExportableCard): RelationAddress[] {
  const relations =
    'card_addresses' in card && Array.isArray(card.card_addresses) ? card.card_addresses : [];
  if (relations.length) return [...relations].sort(comparePrimary);

  const hasTopLevelAddress = [
    card.address_line_1,
    card.address_line_2,
    card.city,
    card.state_region,
    card.postal_code,
    card.country,
  ].some((value) => Boolean(clean(value)));

  return hasTopLevelAddress
    ? [
        {
          address_line_1: card.address_line_1,
          address_line_2: card.address_line_2,
          city: card.city,
          state_region: card.state_region,
          postal_code: card.postal_code,
          country: card.country,
          label: 'work',
          is_primary: true,
        },
      ]
    : [];
}

function buildNote(card: ExportableCard, phones: RelationPhone[]): string | undefined {
  const lines = phones.flatMap((phone) =>
    phoneServices(phone).map((service) => `${service}: ${phone.phone_number}`)
  );
  const uniqueLines = uniqueBy(lines, (line) => line.toLowerCase());
  const originalNote = clean(card.notes);

  if (!originalNote && uniqueLines.length === 0) return undefined;
  return [originalNote, uniqueLines.length ? uniqueLines.join('\n') : undefined].filter(Boolean).join('\n\n');
}

/**
 * Maps Card Nest database records to the exact primitive-only structure supported by
 * Expo Contacts. Relation rows are deliberately reconstructed field by field: database
 * IDs, is_primary flags, service objects, and Card Nest metadata never reach native code.
 */
export function buildNativeContact(
  card: ExportableCard,
  options: NativeContactAdapterOptions = {}
): Contacts.Contact {
  const phones = cardPhones(card);
  const emails = cardEmails(card);
  const websites = cardWebsites(card);
  const addresses = cardAddresses(card);
  const photoUri = clean(options.photoUri);
  const note = buildNote(card, phones);
  const structuredName = [clean(card.first_name), clean(card.middle_name), clean(card.last_name)]
    .filter(Boolean)
    .join(' ');

  return {
    contactType: 'person',
    name: clean(card.display_name) || structuredName || clean(card.company) || 'Card Nest contact',
    ...(clean(card.first_name) ? { firstName: clean(card.first_name) } : {}),
    ...(clean(card.middle_name) ? { middleName: clean(card.middle_name) } : {}),
    ...(clean(card.last_name) ? { lastName: clean(card.last_name) } : {}),
    ...(clean(card.company) ? { company: clean(card.company) } : {}),
    ...(clean(card.job_title) ? { jobTitle: clean(card.job_title) } : {}),
    ...(clean(card.department) ? { department: clean(card.department) } : {}),
    ...(note ? { note } : {}),
    ...(emails.length
      ? {
          emails: emails.map((email) => ({
            email: email.email,
            label: normalizeEmailLabel(email.label),
          })),
        }
      : {}),
    ...(phones.length
      ? {
          phoneNumbers: phones.map((phone) => ({
            number: phone.phone_number,
            label: normalizePhoneLabel(phone.label),
          })),
        }
      : {}),
    ...(addresses.length
      ? {
          addresses: addresses.map((address) => ({
            ...([clean(address.address_line_1), clean(address.address_line_2)].filter(Boolean).length
              ? { street: [clean(address.address_line_1), clean(address.address_line_2)].filter(Boolean).join('\n') }
              : {}),
            ...(clean(address.city) ? { city: clean(address.city) } : {}),
            ...(clean(address.state_region) ? { region: clean(address.state_region) } : {}),
            ...(clean(address.postal_code) ? { postalCode: clean(address.postal_code) } : {}),
            ...(clean(address.country) ? { country: clean(address.country) } : {}),
            label: normalizeAddressLabel(address.label),
          })),
        }
      : {}),
    ...(websites.length
      ? {
          urlAddresses: websites.map((website) => ({
            url: website.url,
            label: normalizeWebsiteLabel(website.label),
          })),
        }
      : {}),
    ...(photoUri?.startsWith('file://') ? { image: { uri: photoUri } } : {}),
  };
}
