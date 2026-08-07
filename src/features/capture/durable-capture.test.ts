import { describe, expect, it, vi } from 'vitest';

import { readCardImageAsBase64, readCardImageBytes } from './capture-files';

const mockUserId = '11111111-1111-4111-8111-111111111111';
const mockCloudCardId = '22222222-2222-4222-8222-222222222222';
const mockMissingCardId = '33333333-3333-4333-8333-333333333333';

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

vi.mock('expo-file-system', () => {
  function MockDirectory(this: any, ...segments: unknown[]) {
    this.uri = segments.join('/');
    this.exists = true;
    this.create = vi.fn();
    this.delete = vi.fn();
  }

  function MockFile(this: any, ...args: unknown[]) {
    const uri = args.map((part: any) => (typeof part === 'string' ? part : part?.uri ?? '')).join('/');
    const isReadable = uri.includes('local-exist') || uri.includes('cardnest-queue');
    this.uri = uri;
    this.exists = isReadable;
    this.size = isReadable ? 1024 : 0;
    this.copy = vi.fn();
    this.write = vi.fn();
    this.base64 = vi.fn().mockResolvedValue('dGVzdC1iYXNlNjQtZGF0YQ==');
    this.bytes = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
  }
  (MockFile as any).downloadFileAsync = vi.fn().mockImplementation((url: string) => {
    if (url.includes('signed-cloud')) return Promise.resolve({});
    return Promise.reject(new Error('UnableToDownload'));
  });

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
        createSignedUrl: vi.fn().mockImplementation((path: string) => {
          if (path.includes(mockCloudCardId)) {
            return Promise.resolve({ data: { signedUrl: 'https://storage.example/signed-cloud/front.jpg' }, error: null });
          }
          return Promise.resolve({ data: null, error: new Error('Object not found') });
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

  it('reads raw bytes for binary upload without any Node Buffer usage', async () => {
    const result = await readCardImageBytes('file:///local-exist/front.jpg');
    expect(result.source).toBe('local');
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.byteSize).toBe(4);
  });

  it('falls back to a native signed-URL download when local file is missing but cloud image exists', async () => {
    const result = await readCardImageAsBase64(
      'file:///missing-local/front.jpg',
      mockCloudCardId,
      'front',
      mockUserId
    );

    expect(result.source).toBe('cloud');
    expect(result.base64).toBeTruthy();
  });

  it('recovers upload bytes from cloud storage after local loss', async () => {
    const result = await readCardImageBytes(
      'file:///missing-local/front.jpg',
      mockCloudCardId,
      'front',
      mockUserId
    );

    expect(result.source).toBe('cloud');
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });

  it('throws a clean unrecoverable error when neither local nor cloud image exists', async () => {
    await expect(
      readCardImageAsBase64('file:///missing-local/front.jpg', mockMissingCardId, 'front', mockUserId)
    ).rejects.toThrow('Card photo file is unrecoverable');
  });
});
