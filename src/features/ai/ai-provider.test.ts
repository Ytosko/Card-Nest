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

describe('documentClassification & VALID_CARD / UNCERTAIN_CARD / NOT_A_CARD', () => {
  it('defaults documentClassification to VALID_CARD if omitted', () => {
    const result = extractedCardSchema.parse({ confidence: 0.85 });
    expect(result.documentClassification.result).toBe('VALID_CARD');
    expect(result.documentClassification.confidence).toBe(1.0);
  });

  it('validates explicit VALID_CARD classification', () => {
    const result = extractedCardSchema.parse({
      documentClassification: {
        result: 'VALID_CARD',
        confidence: 0.98,
        reason: 'Standard visiting card with name and phone',
      },
      displayName: 'Alice Engineer',
      phones: [{ number: '+15551234', label: 'Work', service: '', serviceLabel: '', isPrimary: true }],
      confidence: 0.95,
    });
    expect(result.documentClassification.result).toBe('VALID_CARD');
    expect(result.documentClassification.reason).toContain('Standard visiting card');
  });

  it('validates explicit UNCERTAIN_CARD classification for blurry/handwritten cards', () => {
    const result = extractedCardSchema.parse({
      documentClassification: {
        result: 'UNCERTAIN_CARD',
        confidence: 0.65,
        reason: 'Handwritten note with phone number',
      },
      displayName: 'Bob Note',
      phones: [{ number: '+8801711223344', label: 'Mobile', service: '', serviceLabel: '', isPrimary: true }],
      confidence: 0.6,
    });
    expect(result.documentClassification.result).toBe('UNCERTAIN_CARD');
    expect(result.documentClassification.confidence).toBe(0.65);
  });

  it('validates explicit NOT_A_CARD classification for non-contact images', () => {
    const result = extractedCardSchema.parse({
      documentClassification: {
        result: 'NOT_A_CARD',
        confidence: 0.99,
        reason: 'Landscape photo containing no contact details',
      },
      rawText: '',
      confidence: 0.1,
    });
    expect(result.documentClassification.result).toBe('NOT_A_CARD');
    expect(result.documentClassification.reason).toContain('Landscape photo');
  });
});

describe('extractionPrompt', () => {
  it('includes multilingual guidelines, document classification rules, and phone preservation instructions', () => {
    expect(extractionPrompt.toLowerCase()).toContain('multilingual');
    expect(extractionPrompt).toContain('Bengali');
    expect(extractionPrompt).toContain('VALID_CARD');
    expect(extractionPrompt).toContain('UNCERTAIN_CARD');
    expect(extractionPrompt).toContain('NOT_A_CARD');
    expect(extractionPrompt).toContain('transliteration');
    expect(extractionPrompt).toContain('MUST NOT be translated');
  });
});
