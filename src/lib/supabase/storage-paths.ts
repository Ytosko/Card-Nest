const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const supportedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const;

export const CARD_IMAGES_BUCKET = 'card-images' as const;
export type CardImageSide = 'front' | 'back';
export type CardImageExtension = (typeof supportedExtensions)[number];

export function getCardImageStoragePath(
  userId: string,
  cardId: string,
  side: CardImageSide,
  extension: CardImageExtension,
) {
  if (!uuidPattern.test(userId) || !uuidPattern.test(cardId)) {
    throw new Error('Card image paths require valid user and card IDs.');
  }

  if (!supportedExtensions.includes(extension)) {
    throw new Error('Unsupported card image extension.');
  }

  return `${userId}/${cardId}/${side}.${extension}`;
}
