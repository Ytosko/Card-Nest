import { describe, expect, it, vi } from 'vitest';

import { extractionPrompt } from './ai-provider';
import { extractedCardSchema } from './extraction-schema';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
}));

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

  it('accepts multilingual raw text and transliterated fields', () => {
    const result = extractedCardSchema.parse({
      displayName: 'Saiki Sarkar',
      company: 'Card Nest Labs',
      rawText: 'সাইকি সরকার \n Card Nest Labs \n +8801700000000',
      phones: ['+8801700000000'],
      confidence: 0.95,
    });
    expect(result.rawText).toContain('সাইকি সরকার');
    expect(result.phones).toEqual(['+8801700000000']);
  });
});

describe('extractionPrompt', () => {
  it('includes multilingual guidelines and phone preservation instructions', () => {
    expect(extractionPrompt.toLowerCase()).toContain('multilingual');
    expect(extractionPrompt).toContain('Bengali');
    expect(extractionPrompt).toContain('transliteration');
    expect(extractionPrompt).toContain('MUST NOT be translated');
  });
});
