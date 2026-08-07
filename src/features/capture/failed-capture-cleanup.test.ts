import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteFailedCaptureArtifacts } from '@/src/features/cards/card-service';

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

vi.mock('expo-file-system', () => {
  function MockDirectory() {
    return { exists: true, create: vi.fn(), delete: vi.fn() };
  }
  function MockFile(this: { uri: string }, uri: string) {
    this.uri = uri;
  }
  return { Directory: MockDirectory, File: MockFile, Paths: { document: 'file:///app-doc-dir' } };
});

const storageRemove = vi.fn().mockResolvedValue({ error: null });
const cardDelete = vi.fn().mockResolvedValue({ error: null });
let cardRow: {
  id: string;
  status: string;
  user_id: string;
  contact_photo_path: string | null;
  extraction_quality?: { failed?: boolean; error?: string };
  card_images: { storage_path: string }[];
} | null = null;

vi.mock('@/src/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: cardRow, error: null })),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((_field: string, id: string) => cardDelete(id)),
      }),
    })),
    storage: {
      from: vi.fn().mockReturnValue({
        remove: vi.fn().mockImplementation((paths: string[]) => storageRemove(paths)),
      }),
    },
  },
}));

describe('deleteFailedCaptureArtifacts', () => {
  beforeEach(() => {
    storageRemove.mockClear();
    cardDelete.mockClear();
    cardRow = null;
  });

  it('never deletes a saved contact (status ready)', async () => {
    cardRow = {
      id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      status: 'ready',
      user_id: '11111111-1111-4111-8111-111111111111',
      contact_photo_path: null,
      card_images: [{ storage_path: '11111111-1111-4111-8111-111111111111/aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1/front.jpg' }],
    };

    await deleteFailedCaptureArtifacts('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111');

    expect(cardDelete).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it('never deletes a legacy review card whose extraction succeeded', async () => {
    cardRow = {
      id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      status: 'review',
      user_id: '11111111-1111-4111-8111-111111111111',
      contact_photo_path: null,
      extraction_quality: { failed: false },
      card_images: [],
    };

    await deleteFailedCaptureArtifacts('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111');

    expect(cardDelete).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it('deletes a review placeholder whose extraction failed', async () => {
    cardRow = {
      id: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      status: 'review',
      user_id: '11111111-1111-4111-8111-111111111111',
      contact_photo_path: null,
      extraction_quality: { failed: true, error: 'AI extraction could not read this card.' },
      card_images: [],
    };

    await deleteFailedCaptureArtifacts('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111');

    expect(cardDelete).toHaveBeenCalledWith('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2');
  });

  it('removes the placeholder card record and cloud images for a failed capture', async () => {
    cardRow = {
      id: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      status: 'uploading',
      user_id: '11111111-1111-4111-8111-111111111111',
      contact_photo_path: null,
      card_images: [{ storage_path: '11111111-1111-4111-8111-111111111111/aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2/front.jpg' }],
    };

    await deleteFailedCaptureArtifacts('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111');

    expect(cardDelete).toHaveBeenCalledWith('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2');
    expect(storageRemove).toHaveBeenCalledTimes(1);
    const removedPaths = storageRemove.mock.calls[0][0] as string[];
    expect(removedPaths).toContain('11111111-1111-4111-8111-111111111111/aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2/front.jpg');
    // Deterministic paths are also cleared for uploads whose metadata row was never written.
    expect(removedPaths).toContain('11111111-1111-4111-8111-111111111111/aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2/back.jpg');
  });

  it('still clears deterministic cloud paths when no card record exists', async () => {
    cardRow = null;

    await deleteFailedCaptureArtifacts('aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '11111111-1111-4111-8111-111111111111');

    expect(cardDelete).not.toHaveBeenCalled();
    expect(storageRemove).toHaveBeenCalledTimes(1);
    const removedPaths = storageRemove.mock.calls[0][0] as string[];
    expect(removedPaths).toEqual(
      expect.arrayContaining(['11111111-1111-4111-8111-111111111111/aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3/front.jpg', '11111111-1111-4111-8111-111111111111/aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3/back.jpg'])
    );
  });
});
