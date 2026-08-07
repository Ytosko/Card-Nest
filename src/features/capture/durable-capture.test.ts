import { describe, expect, it, vi } from 'vitest';

import { readCardImageAsBase64 } from './capture-files';

const mockUserId = '11111111-1111-4111-8111-111111111111';
const mockCloudCardId = '22222222-2222-4222-8222-222222222222';
const mockMissingCardId = '33333333-3333-4333-8333-333333333333';

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

vi.mock('expo-file-system', () => {
  function MockDirectory() {
    return {
      exists: true,
      create: vi.fn(),
      delete: vi.fn(),
    };
  }

  function MockFile(this: any, uri: string) {
    const isLocal = uri.includes('local-exist') || uri.includes('cardnest-queue');
    this.uri = uri;
    this.exists = isLocal;
    this.size = isLocal ? 1024 : 0;
    this.copy = vi.fn();
    this.write = vi.fn();
    this.base64 = vi.fn().mockResolvedValue('dGVzdC1iYXNlNjQtZGF0YQ==');
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: { document: 'file:///app-doc-dir' },
  };
});

vi.mock('@/src/lib/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockImplementation((path: string) => {
          if (path.includes(mockCloudCardId)) {
            return Promise.resolve({
              data: {
                size: 2048,
                arrayBuffer: () => Promise.resolve(Buffer.from('cloud-image-binary-data')),
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: new Error('File not found') });
        }),
      }),
    },
  },
}));

describe('Durable Capture File Architecture & Cloud Fallback', () => {
  it('reads base64 directly from local persistent storage when local file exists', async () => {
    const result = await readCardImageAsBase64('file:///local-exist/front.jpg');
    expect(result.source).toBe('local');
    expect(result.base64).toBe('dGVzdC1iYXNlNjQtZGF0YQ==');
    expect(result.byteSize).toBe(1024);
  });

  it('falls back to cloud storage when local file is missing but cloud image exists', async () => {
    const result = await readCardImageAsBase64(
      'file:///missing-local/front.jpg',
      mockCloudCardId,
      'front',
      mockUserId
    );

    expect(result.source).toBe('cloud');
    expect(result.base64).toBeTruthy();
    expect(result.byteSize).toBe(2048);
  });

  it('throws a clean unrecoverable error when neither local nor cloud image exists', async () => {
    await expect(
      readCardImageAsBase64('file:///missing-local/front.jpg', mockMissingCardId, 'front', mockUserId)
    ).rejects.toThrow('Card photo file is unrecoverable');
  });
});
