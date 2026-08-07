import { describe, expect, it } from 'vitest';

import { extractedCardSchema } from './extraction-schema';

describe('extractedCardSchema', () => {
  it('defaults optional extraction fields without inventing values', () => {
    const result = extractedCardSchema.parse({ confidence: 0.72 });
    expect(result.displayName).toBe('');
    expect(result.emails).toEqual([]);
    expect(result.confidence).toBe(0.72);
  });

  it('rejects impossible confidence values', () => {
    expect(() => extractedCardSchema.parse({ confidence: 2 })).toThrow();
  });
});
