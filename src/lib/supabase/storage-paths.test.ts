import { describe, expect, it } from 'vitest';

import { getCardImageStoragePath } from './storage-paths';

const userId = '33333333-3333-4333-8333-333333333333';
const cardId = '44444444-4444-4444-8444-444444444444';

describe('card image storage paths', () => {
  it('places every image under the authenticated user folder', () => {
    expect(getCardImageStoragePath(userId, cardId, 'front', 'jpg')).toBe(
      `${userId}/${cardId}/front.jpg`,
    );
  });

  it('rejects malformed ownership identifiers', () => {
    expect(() => getCardImageStoragePath('not-a-user', cardId, 'back', 'webp')).toThrow();
  });
});
