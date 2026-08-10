import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CardWithRelations } from '@/src/features/cards/card-service';

import { checkNativeContactMatch, exportCardToContacts, exportCardsToContacts } from './contact-export';

const mocks = vi.hoisted(() => ({
  addContactAsync: vi.fn().mockResolvedValue('native-contact-1'),
  presentFormAsync: vi.fn().mockResolvedValue(0),
  getContactsAsync: vi.fn(),
  getPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  getSignedContactPhotoUrl: vi.fn().mockResolvedValue('https://storage.example/signed-photo'),
  downloadFileAsync: vi.fn().mockResolvedValue(undefined),
  deletePhoto: vi.fn(),
}));

vi.mock('expo-contacts', () => ({
  addContactAsync: mocks.addContactAsync,
  presentFormAsync: mocks.presentFormAsync,
  getContactsAsync: mocks.getContactsAsync,
  getPermissionsAsync: mocks.getPermissionsAsync,
  requestPermissionsAsync: mocks.requestPermissionsAsync,
  Fields: { Emails: 'emails', PhoneNumbers: 'phoneNumbers' },
}));

vi.mock('expo-file-system', () => {
  class MockFile {
    static downloadFileAsync = mocks.downloadFileAsync;
    uri = 'file:///cache/card-nest-contact-export-card-1.jpg';
    exists = true;
    delete = mocks.deletePhoto;
  }

  return { File: MockFile, Paths: { cache: 'file:///cache/' } };
});

vi.mock('@/src/features/cards/card-service', () => ({
  getSignedContactPhotoUrl: mocks.getSignedContactPhotoUrl,
}));

function makeCard(overrides: Partial<CardWithRelations> = {}): CardWithRelations {
  return {
    id: 'card-1',
    user_id: 'user-1',
    display_name: 'Ada Lovelace',
    first_name: 'Ada',
    middle_name: null,
    last_name: 'Lovelace',
    company: 'Analytical Engines',
    job_title: 'Engineer',
    department: 'Research',
    primary_email: 'ada@engines.example',
    primary_phone: '+880 1711-000001',
    notes: 'Met at the computing conference.',
    contact_photo_path: null,
    website: null,
    address_line_1: null,
    address_line_2: null,
    city: null,
    state_region: null,
    postal_code: null,
    country: null,
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
    vi.clearAllMocks();
    mocks.requestPermissionsAsync.mockResolvedValue({ granted: true });
    mocks.getPermissionsAsync.mockResolvedValue({ granted: true });
    mocks.addContactAsync.mockResolvedValue('native-contact-1');
    mocks.presentFormAsync.mockResolvedValue(0);
    mocks.getContactsAsync
      .mockReset()
      .mockResolvedValueOnce({ data: [], hasNextPage: false })
      .mockResolvedValue({
        data: [{ id: 'native-contact-1', emails: [{ email: 'ada@engines.example' }], phoneNumbers: [] }],
        hasNextPage: false,
      });
    mocks.getSignedContactPhotoUrl.mockResolvedValue('https://storage.example/signed-photo');
    mocks.downloadFileAsync.mockResolvedValue(undefined);
  });

  it('exports a rich contact through one primitive-only native payload', async () => {
    const card = makeCard({
      contact_photo_path: 'user-1/card-1/photo.jpg',
      card_emails: [
        { email: 'ada@engines.example', label: 'work', is_primary: true },
        { email: 'ada@personal.example', label: 'personal', is_primary: false },
      ],
      card_phone_numbers: [
        {
          phone_number: '+880 1711-000001',
          label: 'mobile',
          service: 'whatsapp,bkash',
          service_label: 'WhatsApp, bKash',
          is_primary: true,
        },
        { phone_number: '+880 2-955555', label: 'office', service: null, service_label: null, is_primary: false },
        { phone_number: '+880 2-955556', label: 'fax', service: null, service_label: null, is_primary: false },
      ],
      card_websites: [
        { url: 'https://analytical.example', label: 'work', is_primary: true },
        { url: 'ada.example/portfolio', label: 'portfolio', is_primary: false },
      ],
      card_addresses: [
        {
          address_line_1: '12 Engine Road',
          address_line_2: 'Suite 3',
          city: 'Dhaka',
          state_region: 'Dhaka',
          postal_code: '1205',
          country: 'Bangladesh',
          label: 'work',
          is_primary: true,
        },
      ],
    } as unknown as Partial<CardWithRelations>);

    await expect(exportCardToContacts(card)).resolves.toBe('native-contact-1');

    expect(mocks.getSignedContactPhotoUrl).toHaveBeenCalledWith('user-1/card-1/photo.jpg');
    expect(mocks.downloadFileAsync).toHaveBeenCalledWith(
      'https://storage.example/signed-photo',
      expect.objectContaining({ uri: 'file:///cache/card-nest-contact-export-card-1.jpg' }),
      { idempotent: true }
    );
    expect(mocks.presentFormAsync).toHaveBeenCalledTimes(1);
    expect(mocks.presentFormAsync.mock.calls[0][0]).toBeNull();
    expect(mocks.addContactAsync).not.toHaveBeenCalled();
    expect(mocks.deletePhoto).toHaveBeenCalledTimes(1);

    const payload = mocks.presentFormAsync.mock.calls[0][1];
    expect(payload).toMatchObject({
      contactType: 'person',
      name: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      company: 'Analytical Engines',
      jobTitle: 'Engineer',
      department: 'Research',
      image: { uri: 'file:///cache/card-nest-contact-export-card-1.jpg' },
    });
    expect(payload.phoneNumbers).toEqual([
      { number: '+880 1711-000001', label: 'mobile' },
      { number: '+880 2-955555', label: 'work' },
      { number: '+880 2-955556', label: 'faxWork' },
    ]);
    expect(payload.emails).toEqual([
      { email: 'ada@engines.example', label: 'work' },
      { email: 'ada@personal.example', label: 'personal' },
    ]);
    expect(payload.urlAddresses).toEqual([
      { url: 'https://analytical.example/', label: 'work' },
      { url: 'https://ada.example/portfolio', label: 'portfolio' },
    ]);
    expect(payload.addresses).toEqual([
      {
        street: '12 Engine Road\nSuite 3',
        city: 'Dhaka',
        region: 'Dhaka',
        postalCode: '1205',
        country: 'Bangladesh',
        label: 'work',
      },
    ]);
    expect(payload.note).toBe(
      'Met at the computing conference.\n\nWhatsApp: +880 1711-000001\nbKash: +880 1711-000001'
    );

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('is_primary');
    expect(serialized).not.toContain('isPrimary');
    expect(serialized).not.toContain('service_label');
    expect(serialized).not.toContain('"service"');
  });

  it('falls back to primary phone and email values when relational rows are unavailable', async () => {
    await exportCardToContacts(makeCard());

    const payload = mocks.presentFormAsync.mock.calls[0][1];
    expect(payload.emails).toEqual([{ email: 'ada@engines.example', label: 'work' }]);
    expect(payload.phoneNumbers).toEqual([{ number: '+880 1711-000001', label: 'mobile' }]);
  });

  it('cleans up the temporary photo even if native contact creation fails', async () => {
    mocks.presentFormAsync.mockRejectedValueOnce(new Error('Native editor failed'));

    await expect(
      exportCardToContacts(makeCard({ contact_photo_path: 'user-1/card-1/photo.jpg' }))
    ).rejects.toThrow('Native editor failed');
    expect(mocks.deletePhoto).toHaveBeenCalledTimes(1);
  });

  it('never attempts the native write when Contacts permission is denied', async () => {
    mocks.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });

    await expect(exportCardToContacts(makeCard())).rejects.toThrow('Contact permission is needed');
    expect(mocks.addContactAsync).not.toHaveBeenCalled();
    expect(mocks.presentFormAsync).not.toHaveBeenCalled();
  });

  it('does not report success when the native editor closes without saving', async () => {
    mocks.getContactsAsync.mockResolvedValue({ data: [] });

    await expect(exportCardToContacts(makeCard())).resolves.toBeNull();
    expect(mocks.presentFormAsync).toHaveBeenCalledTimes(1);
  });

  it('does not mistake a pre-existing matching contact for a newly saved contact', async () => {
    mocks.getContactsAsync.mockReset().mockResolvedValue({
      data: [{ id: 'existing-contact', emails: [{ email: 'ada@engines.example' }], phoneNumbers: [] }],
      hasNextPage: false,
    });

    await expect(exportCardToContacts(makeCard())).resolves.toBeNull();
  });

  it('uses direct default-account insertion for bulk export without opening editors', async () => {
    const cards = [makeCard(), makeCard({ id: 'card-2', primary_email: 'grace@example.com' })];
    mocks.addContactAsync
      .mockResolvedValueOnce('native-contact-1')
      .mockResolvedValueOnce('native-contact-2');

    const result = await exportCardsToContacts(cards);

    expect(mocks.presentFormAsync).not.toHaveBeenCalled();
    expect(mocks.addContactAsync).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      succeeded: [
        { cardId: 'card-1', nativeContactId: 'native-contact-1' },
        { cardId: 'card-2', nativeContactId: 'native-contact-2' },
      ],
      failed: [],
    });
  });

  it('keeps per-contact failures in the bulk result', async () => {
    const cards = [makeCard(), makeCard({ id: 'card-2' })];
    mocks.addContactAsync
      .mockResolvedValueOnce('native-contact-1')
      .mockRejectedValueOnce(new Error('Default destination is not writable'));

    const result = await exportCardsToContacts(cards);

    expect(result.succeeded).toEqual([{ cardId: 'card-1', nativeContactId: 'native-contact-1' }]);
    expect(result.failed).toEqual([
      { cardId: 'card-2', message: 'Default destination is not writable' },
    ]);
  });
});

describe('checkNativeContactMatch', () => {
  it('matches on a secondary phone number, not just the primary', async () => {
    mocks.getContactsAsync.mockReset().mockResolvedValue({
      data: [{ id: 'native-9', emails: [], phoneNumbers: [{ number: '+880 2 955555' }] }],
    });

    const card = makeCard({
      card_phone_numbers: [
        { phone_number: '+880 1711-000001', label: 'mobile', is_primary: true },
        { phone_number: '+880 2-955555', label: 'work', is_primary: false },
      ],
    } as unknown as Partial<CardWithRelations>);

    const match = await checkNativeContactMatch(card);
    expect(match).toEqual({ isMatched: true, nativeContactId: 'native-9' });
  });

  it('does not match on names alone when no values overlap', async () => {
    mocks.getContactsAsync.mockReset().mockResolvedValue({
      data: [{ id: 'native-2', name: 'Ada Lovelace', emails: [], phoneNumbers: [{ number: '+15550100' }] }],
    });

    const match = await checkNativeContactMatch(makeCard());
    expect(match.isMatched).toBe(false);
  });
});
