import { describe, expect, it, vi } from 'vitest';

import { extractionPrompt, validateExtractionResponse, AiExtractionError } from './ai-provider';
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

  it('accepts multilingual raw text and structured phone/email items', () => {
    const result = extractedCardSchema.parse({
      displayName: 'Saiki Sarkar',
      company: 'Card Nest Labs',
      rawText: 'সাইকি সরকার \n Card Nest Labs \n +8801700000000',
      phones: [{ number: '+8801700000000', label: 'Mobile', service: 'whatsapp', serviceLabel: 'WhatsApp', isPrimary: true }],
      emails: [{ email: 'saiki@cardnest.dev', label: 'Work', isPrimary: true }],
      confidence: 0.95,
    });
    expect(result.rawText).toContain('সাইকি সরকার');
    expect(result.phones[0].number).toBe('+8801700000000');
    expect(result.phones[0].service).toBe('whatsapp');
    expect(result.emails[0].email).toBe('saiki@cardnest.dev');
  });

  it('transforms legacy string array phones into structured phone items', () => {
    const result = extractedCardSchema.parse({
      phones: ['+1 555-0199'],
      confidence: 0.8,
    });
    expect(result.phones[0].number).toBe('+1 555-0199');
    expect(result.phones[0].label).toBe('Mobile');
  });
});

describe('validateExtractionResponse', () => {
  it('validates successful structural payload without throwing', () => {
    const result = validateExtractionResponse(
      {
        displayName: 'Test Contact',
        company: 'Card Nest Inc',
        phones: [{ number: '+1234567890', label: 'Mobile', service: '', serviceLabel: '', isPrimary: true }],
        emails: [{ email: 'test@cardnest.dev', label: 'Work', isPrimary: true }],
        confidence: 0.9,
      },
      'gemini',
      'gemini-3.5-flash-lite'
    );
    expect(result.displayName).toBe('Test Contact');
    expect(result.phones[0].number).toBe('+1234567890');
  });

  it('throws AiExtractionError with stage validateExtractionResponse when schema is invalid', () => {
    expect(() =>
      validateExtractionResponse({ confidence: 'invalid' }, 'gemini', 'gemini-3.5-flash-lite')
    ).toThrowError(AiExtractionError);
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
