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

export async function readCardImageAsBase64(
  imageUri: string,
  cardId?: string,
  side: 'front' | 'back' = 'front',
  userId?: string
): Promise<ReadImageResult> {
  const localFile = new File(imageUri);

  // 1. Primary path: Local durable persistent file
  if (localFile.exists && localFile.size > 0) {
    try {
      const base64Data = await localFile.base64();
      if (base64Data && base64Data.length > 0) {
        if (__DEV__) {
          console.log(`[CardNest Capture Files] Read local image for extraction`, {
            cardId,
            side,
            source: 'local',
            scheme: imageUri.slice(0, 15),
            exists: true,
            byteSize: localFile.size,
          });
        }
        return { base64: base64Data, source: 'local', byteSize: localFile.size };
      }
    } catch {
      // Local read failed, fall through to cloud fallback recovery
    }
  }

  // 2. Fallback path: Already uploaded cloud image in Supabase Storage
  if (cardId && userId) {
    const storagePath = getCardImageStoragePath(userId, cardId, side, 'jpg');
    if (__DEV__) {
      console.warn(`[CardNest Capture Files] Local file missing or unreadable, attempting cloud storage fallback...`, {
        cardId,
        side,
        localUri: imageUri,
        storagePath,
      });
    }

    try {
      const { data, error } = await supabase.storage.from('card-images').download(storagePath);
      if (!error && data) {
        const buffer = await data.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString('base64');

        if (base64Data && base64Data.length > 0) {
          // Re-persist downloaded image back to local persistent store for future operations
          try {
            const directory = new Directory(Paths.document, 'cardnest-queue', cardId);
            if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
            const restoredFile = new File(directory, `${side}.jpg`);
            restoredFile.write(base64Data);
          } catch {
            // Ignore re-persist errors
          }

          if (__DEV__) {
            console.log(`[CardNest Capture Files] Recovered card image from cloud storage`, {
              cardId,
              side,
              source: 'cloud',
              storagePath,
              byteSize: data.size,
            });
          }

          return { base64: base64Data, source: 'cloud', byteSize: data.size };
        }
      }
    } catch {
      // Cloud fallback failed
    }
  }

  // 3. Neither local nor cloud image exists: Unrecoverable
  if (__DEV__) {
    console.error(`[CardNest Capture Files] Card photo file unrecoverable`, {
      cardId,
      side,
      localUri: imageUri,
      localExists: localFile.exists,
      localSize: localFile.size,
    });
  }

  throw new Error('Card photo file is unrecoverable locally and not found in cloud storage. Please capture this business card again.');
}

export function removePreparedCapture(captureId: string) {
  try {
    const directory = new Directory(Paths.document, 'cardnest-queue', captureId);
    if (directory.exists) directory.delete();
  } catch {
    // Ignore cleanup errors
  }
}
