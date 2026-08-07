import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkNativeContactMatch, exportCardToContacts } from './contact-export';
import type { CardWithRelations } from '@/src/features/cards/card-service';

const addContactAsync = vi.fn().mockResolvedValue('native-contact-1');
const getContactsAsync = vi.fn();
const getPermissionsAsync = vi.fn().mockResolvedValue({ granted: true });
const requestPermissionsAsync = vi.fn().mockResolvedValue({ granted: true });

vi.mock('expo-contacts', () => ({
  get addContactAsync() {
    return addContactAsync;
  },
  get getContactsAsync() {
    return getContactsAsync;
  },
  get getPermissionsAsync() {
    return getPermissionsAsync;
  },
  get requestPermissionsAsync() {
    return requestPermissionsAsync;
  },
  Fields: { Emails: 'emails', PhoneNumbers: 'phoneNumbers' },
  ContactTypes: { Person: 'person' },
}));

function makeCard(overrides: Partial<CardWithRelations> = {}): CardWithRelations {
  return {
    id: 'card-1',
    user_id: 'user-1',
    display_name: 'Ada Lovelace',
    first_name: 'Ada',
    last_name: 'Lovelace',
    company: 'Analytical Engines',
    job_title: 'Engineer',
    primary_email: 'ada@engines.example',
    primary_phone: '+880 1711-000001',
    card_emails: [],
    card_phone_numbers: [],
    card_websites: [],
    card_addresses: [],
    card_images: [],
    card_tags: [],
    ...overrides,
  } as unknown as CardWithRelations;
}

describe('exportCardToContacts', () => {
  beforeEach(() => {
    addContactAsync.mockClear();
  });

  it('exports every phone number and email with labels, not just the primaries', async () => {
    const card = makeCard({
      card_emails: [
        { email: 'ada@engines.example', label: 'work', is_primary: true },
        { email: 'ada@personal.example', label: 'personal', is_primary: false },
      ],
      card_phone_numbers: [
        { phone_number: '+880 1711-000001', label: 'mobile', is_primary: true },
        { phone_number: '+880 2-955555', label: 'work', is_primary: false },
        { phone_number: '+880 2-955556', label: 'fax', is_primary: false },
      ],
    } as unknown as Partial<CardWithRelations>);

    await exportCardToContacts(card);

    expect(addContactAsync).toHaveBeenCalledTimes(1);
    const payload = addContactAsync.mock.calls[0][0];

    expect(payload.emails).toHaveLength(2);
    expect(payload.emails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'ada@engines.example', isPrimary: true }),
        expect.objectContaining({ email: 'ada@personal.example', label: 'personal' }),
      ])
    );

    expect(payload.phoneNumbers).toHaveLength(3);
    expect(payload.phoneNumbers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ number: '+880 1711-000001', isPrimary: true }),
        expect.objectContaining({ number: '+880 2-955555', label: 'work' }),
        expect.objectContaining({ number: '+880 2-955556', label: 'fax' }),
      ])
    );
  });

  it('falls back to primary values when no relational rows exist', async () => {
    await exportCardToContacts(makeCard());

    const payload = addContactAsync.mock.calls[0][0];
    expect(payload.emails).toEqual([expect.objectContaining({ email: 'ada@engines.example', isPrimary: true })]);
    expect(payload.phoneNumbers).toEqual([
      expect.objectContaining({ number: '+880 1711-000001', isPrimary: true }),
    ]);
  });
});

describe('checkNativeContactMatch', () => {
  it('matches on a secondary phone number, not just the primary', async () => {
    getContactsAsync.mockResolvedValue({
      data: [
        {
          id: 'native-9',
          emails: [],
          phoneNumbers: [{ number: '+880 2 955555' }],
        },
      ],
    });

    const card = makeCard({
      card_phone_numbers: [
        { phone_number: '+880 1711-000001', label: 'mobile', is_primary: true },
        { phone_number: '+880 2-955555', label: 'work', is_primary: false },
      ],
    } as unknown as Partial<CardWithRelations>);

    const match = await checkNativeContactMatch(card);
    expect(match.isMatched).toBe(true);
    expect(match.nativeContactId).toBe('native-9');
  });

  it('does not match on names alone when no values overlap', async () => {
    getContactsAsync.mockResolvedValue({
      data: [{ id: 'native-2', name: 'Ada Lovelace', emails: [], phoneNumbers: [{ number: '+15550100' }] }],
    });

    const match = await checkNativeContactMatch(makeCard());
    expect(match.isMatched).toBe(false);
  });
});
