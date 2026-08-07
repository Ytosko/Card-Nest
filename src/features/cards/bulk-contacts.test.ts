import { describe, expect, it, vi } from 'vitest';

import { bulkDeleteCards, bulkToggleFavorite } from './card-service';
import type { Card } from '@/src/types/database.helpers';

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

vi.mock('expo-file-system', () => {
  function MockDirectory() {
    return { exists: true, create: vi.fn(), delete: vi.fn() };
  }
  function MockFile(this: any, uri: string) {
    this.uri = uri;
    this.exists = true;
    this.size = 1024;
    this.bytes = vi.fn().mockResolvedValue(new Uint8Array(8));
  }
  return { Directory: MockDirectory, File: MockFile, Paths: { document: 'file:///app-doc-dir' } };
});

vi.mock('@/src/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'cards') {
        return {
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_field: string, id: string) => {
              if (id === 'failed-card-id') {
                return Promise.resolve({ error: new Error('Database RLS error') });
              }
              return Promise.resolve({ error: null });
            }),
          }),
        };
      }
      return {};
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  },
}));

describe('Bulk Contacts Operations', () => {
  const mockCards: Card[] = [
    {
      id: 'c1',
      user_id: 'user-1',
      status: 'ready',
      display_name: 'Contact 1',
      first_name: 'Contact',
      middle_name: null,
      last_name: '1',
      company: 'Acme',
      job_title: 'CEO',
      department: null,
      primary_email: 'c1@acme.com',
      primary_phone: '+15550199',
      website: null,
      address_line_1: null,
      address_line_2: null,
      city: null,
      state_region: null,
      postal_code: null,
      country: null,
      notes: null,
      raw_extracted_text: null,
      extraction_provider: 'gemini',
      extraction_model: 'gemini-3.5-flash-lite',
      extraction_confidence: 0.9,
      extraction_quality: {},
      source_front_image_path: 'user-1/c1/front.jpg',
      source_back_image_path: null,
      contact_photo_path: 'user-1/c1/photo.jpg',
      source_hash: null,
      duplicate_of_id: null,
      is_favorite: false,
      last_exported_to_contacts_at: null,
      search_vector: null,
      created_at: '2026-08-07T10:00:00.000Z',
      updated_at: '2026-08-07T10:00:00.000Z',
    },
    {
      id: 'c2',
      user_id: 'user-1',
      status: 'ready',
      display_name: 'Contact 2',
      first_name: 'Contact',
      middle_name: null,
      last_name: '2',
      company: 'Beta',
      job_title: 'CTO',
      department: null,
      primary_email: 'c2@beta.com',
      primary_phone: '+15550200',
      website: null,
      address_line_1: null,
      address_line_2: null,
      city: null,
      state_region: null,
      postal_code: null,
      country: null,
      notes: null,
      raw_extracted_text: null,
      extraction_provider: 'gemini',
      extraction_model: 'gemini-3.5-flash-lite',
      extraction_confidence: 0.95,
      extraction_quality: {},
      source_front_image_path: 'user-1/c2/front.jpg',
      source_back_image_path: null,
      contact_photo_path: null,
      source_hash: null,
      duplicate_of_id: null,
      is_favorite: false,
      last_exported_to_contacts_at: null,
      search_vector: null,
      created_at: '2026-08-07T10:00:00.000Z',
      updated_at: '2026-08-07T10:00:00.000Z',
    },
  ];

  it('bulk favorites selected cards via Supabase in query', async () => {
    await expect(bulkToggleFavorite(['c1', 'c2'], true)).resolves.not.toThrow();
  });

  it('deletes selected cards and returns exact deleted count on full success', async () => {
    const result = await bulkDeleteCards(mockCards);
    expect(result.deletedCount).toBe(2);
    expect(result.failedIds).toHaveLength(0);
  });

  it('handles partial deletion failures without falsely claiming all were deleted', async () => {
    const cardWithFailure: Card = { ...mockCards[0], id: 'failed-card-id' };
    const mixedCards = [mockCards[1], cardWithFailure];

    const result = await bulkDeleteCards(mixedCards);
    expect(result.deletedCount).toBe(1);
    expect(result.failedIds).toEqual(['failed-card-id']);
  });
});
