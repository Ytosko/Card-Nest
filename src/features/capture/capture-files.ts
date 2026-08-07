import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/src/lib/supabase/client';
import { getCardImageStoragePath } from '@/src/lib/supabase/storage-paths';

export type PreparedCapture = { frontUri: string; backUri: string | null };

export type ReadImageResult = {
  base64: string;
  source: 'local' | 'cloud';
  byteSize: number;
};

export type ReadImageBytesResult = {
  bytes: Uint8Array;
  source: 'local' | 'cloud';
  byteSize: number;
};

/**
 * Copies a Uint8Array into a plain ArrayBuffer for network upload. TypeScript types
 * `Uint8Array.buffer` as `ArrayBufferLike` (possibly SharedArrayBuffer), which fetch
 * bodies reject; an explicit copy guarantees a plain ArrayBuffer.
 */
export function toUploadArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

const UNRECOVERABLE_MESSAGE =
  'Card photo file is unrecoverable locally and not found in cloud storage. Please capture this business card again.';

async function prepareSide(sourceUri: string, captureId: string, side: 'front' | 'back'): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 1_600 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
  );

  const directory = new Directory(Paths.document, 'cardnest-queue', captureId);
  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }

  const destination = new File(directory, `${side}.jpg`);

  // Durable copy into persistent Card Nest application storage
  try {
    const sourceFile = new File(result.uri);
    sourceFile.copy(destination);
  } catch {
    // Fallback: direct copy from original sourceUri if manipulator cache URI fails
    const origFile = new File(sourceUri);
    origFile.copy(destination);
  }

  // Verification step: verify file exists, size > 0, and readable
  if (!destination.exists || destination.size === 0) {
    throw new Error(`Durable file creation failed for capture ${captureId} side ${side}. File does not exist or is 0 bytes.`);
  }

  return destination.uri;
}

export async function prepareCaptureFiles(
  captureId: string,
  frontUri: string,
  backUri?: string | null
): Promise<PreparedCapture> {
  const preparedFront = await prepareSide(frontUri, captureId, 'front');
  const preparedBack = backUri ? await prepareSide(backUri, captureId, 'back') : null;

  if (__DEV__) {
    const frontFile = new File(preparedFront);
    const backFile = preparedBack ? new File(preparedBack) : null;

    console.log(`[CardNest Capture Files] Prepared durable capture files`, {
      captureId,
      frontScheme: preparedFront.slice(0, 15),
      frontExists: frontFile.exists,
      frontSize: frontFile.size,
      backScheme: preparedBack?.slice(0, 15) ?? null,
      backExists: backFile?.exists ?? false,
      backSize: backFile?.size ?? 0,
    });
  }

  return { frontUri: preparedFront, backUri: preparedBack };
}

function readableLocalFile(imageUri: string): File | null {
  const file = new File(imageUri);
  return file.exists && file.size > 0 ? file : null;
}

/**
 * Recovers an already-uploaded card image from private Supabase Storage back into the
 * durable local queue directory via a short-lived signed URL and a native download —
 * no Node Buffer or Blob conversion, which do not exist in React Native/Hermes.
 */
async function recoverFromCloud(cardId: string, side: 'front' | 'back', userId: string): Promise<File | null> {
  const storagePath = getCardImageStoragePath(userId, cardId, side, 'jpg');

  if (__DEV__) {
    console.warn(`[CardNest Capture Files] Local file missing or unreadable, attempting cloud storage fallback...`, {
      cardId,
      side,
      storagePath,
    });
  }

  try {
    const { data: signed, error: signError } = await supabase.storage
      .from('card-images')
      .createSignedUrl(storagePath, 600);
    if (signError || !signed?.signedUrl) return null;

    const directory = new Directory(Paths.document, 'cardnest-queue', cardId);
    if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
    const destination = new File(directory, `${side}.jpg`);

    await File.downloadFileAsync(signed.signedUrl, destination, { idempotent: true });

    if (!destination.exists || destination.size === 0) return null;

    if (__DEV__) {
      console.log(`[CardNest Capture Files] Recovered card image from cloud storage`, {
        cardId,
        side,
        source: 'cloud',
        byteSize: destination.size,
      });
    }

    return destination;
  } catch {
    return null;
  }
}

async function resolveReadableFile(
  imageUri: string,
  cardId?: string,
  side: 'front' | 'back' = 'front',
  userId?: string
): Promise<{ file: File; source: 'local' | 'cloud' } | null> {
  const localFile = readableLocalFile(imageUri);
  if (localFile) return { file: localFile, source: 'local' };

  if (cardId && userId) {
    const recovered = await recoverFromCloud(cardId, side, userId);
    if (recovered) return { file: recovered, source: 'cloud' };
  }

  if (__DEV__) {
    console.error(`[CardNest Capture Files] Card photo file unrecoverable`, {
      cardId,
      side,
      uriScheme: imageUri.slice(0, 15),
    });
  }

  return null;
}

/**
 * Reads a card image as raw bytes for binary Storage upload. React Native has no Node
 * `Buffer`; expo-file-system's `File.bytes()` returns a `Uint8Array` natively.
 */
export async function readCardImageBytes(
  imageUri: string,
  cardId?: string,
  side: 'front' | 'back' = 'front',
  userId?: string
): Promise<ReadImageBytesResult> {
  const resolved = await resolveReadableFile(imageUri, cardId, side, userId);
  if (!resolved) throw new Error(UNRECOVERABLE_MESSAGE);

  const bytes = await resolved.file.bytes();
  if (!bytes || bytes.byteLength === 0) throw new Error(UNRECOVERABLE_MESSAGE);

  if (__DEV__) {
    console.log(`[CardNest Capture Files] Read card image bytes`, {
      cardId,
      side,
      source: resolved.source,
      uriScheme: resolved.file.uri.slice(0, 15),
      exists: true,
      byteSize: bytes.byteLength,
      mimeType: 'image/jpeg',
    });
  }

  return { bytes, source: resolved.source, byteSize: bytes.byteLength };
}

/**
 * Reads a card image as base64 for AI extraction payloads. Base64 is produced natively
 * by expo-file-system (never via Node Buffer). Image contents are never logged.
 */
export async function readCardImageAsBase64(
  imageUri: string,
  cardId?: string,
  side: 'front' | 'back' = 'front',
  userId?: string
): Promise<ReadImageResult> {
  const resolved = await resolveReadableFile(imageUri, cardId, side, userId);
  if (!resolved) throw new Error(UNRECOVERABLE_MESSAGE);

  const base64Data = await resolved.file.base64();
  if (!base64Data || base64Data.length === 0) throw new Error(UNRECOVERABLE_MESSAGE);

  if (__DEV__) {
    console.log(`[CardNest Capture Files] Read card image for extraction`, {
      cardId,
      side,
      source: resolved.source,
      uriScheme: resolved.file.uri.slice(0, 15),
      exists: true,
      byteSize: resolved.file.size,
    });
  }

  return { base64: base64Data, source: resolved.source, byteSize: resolved.file.size };
}

export function removePreparedCapture(captureId: string) {
  try {
    const directory = new Directory(Paths.document, 'cardnest-queue', captureId);
    if (directory.exists) directory.delete();
  } catch {
    // Ignore cleanup errors
  }
}
