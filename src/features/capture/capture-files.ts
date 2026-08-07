import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

export type PreparedCapture = { frontUri: string; backUri: string | null };

async function prepareSide(sourceUri: string, captureId: string, side: 'front' | 'back') {
  const result = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 1_600 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
  );
  const directory = new Directory(Paths.document, 'cardnest-queue', captureId);
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${side}.jpg`);
  new File(result.uri).copy(destination);
  return destination.uri;
}

export async function prepareCaptureFiles(captureId: string, frontUri: string, backUri?: string | null): Promise<PreparedCapture> {
  const preparedFront = await prepareSide(frontUri, captureId, 'front');
  const preparedBack = backUri ? await prepareSide(backUri, captureId, 'back') : null;
  return { frontUri: preparedFront, backUri: preparedBack };
}

export function removePreparedCapture(captureId: string) {
  const directory = new Directory(Paths.document, 'cardnest-queue', captureId);
  if (directory.exists) directory.delete();
}
