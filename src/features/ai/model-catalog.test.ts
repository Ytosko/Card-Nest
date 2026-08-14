import { describe, expect, it, vi } from 'vitest';

import { classifyProviderHttpError } from './ai-provider';
import {
  geminiModelInfo,
  isGeminiModelEligible,
  isOpenAiModelCandidate,
  openAiFriendlyName,
  pickDefaultModel,
  type AiModelInfo,
} from './model-catalog';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
}));

vi.mock('expo-file-system', () => {
  function MockDirectory() {
    return { exists: true, create: vi.fn() };
  }
  function MockFile(this: any) {
    this.exists = false;
    this.write = vi.fn();
    this.textSync = vi.fn();
  }
  return { Directory: MockDirectory, File: MockFile, Paths: { document: 'file:///doc' } };
});

describe('Gemini capability filtering', () => {
  const generate = { supportedGenerationMethods: ['generateContent', 'countTokens'] };

  it('accepts current and future generateContent Gemini models without a name whitelist', () => {
    expect(isGeminiModelEligible({ name: 'models/gemini-2.5-flash', ...generate })).toBe(true);
    expect(isGeminiModelEligible({ name: 'models/gemini-2.5-flash-lite', ...generate })).toBe(true);
    expect(isGeminiModelEligible({ name: 'models/gemini-3.5-flash-lite', ...generate })).toBe(true);
    expect(isGeminiModelEligible({ name: 'models/gemini-9.0-ultra-hypothetical', ...generate })).toBe(true);
  });

  it('rejects models lacking generateContent regardless of name', () => {
    expect(isGeminiModelEligible({ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['embedContent'] })).toBe(false);
    expect(isGeminiModelEligible({ name: 'models/gemini-2.5-flash' })).toBe(false);
  });

  it('rejects capability categories that cannot run image-to-JSON extraction', () => {
    for (const name of [
      'models/text-embedding-004',
      'models/gemini-embedding-001',
      'models/aqa',
      'models/gemini-2.5-flash-preview-tts',
      'models/gemini-2.5-flash-native-audio-dialog',
      'models/gemini-2.0-flash-live-001',
      'models/gemini-2.0-flash-preview-image-generation',
      'models/imagen-3.0-generate-002',
      'models/veo-2.0-generate-001',
    ]) {
      expect(isGeminiModelEligible({ name, ...generate })).toBe(false);
    }
  });

  it('uses provider display names with the exact ID preserved', () => {
    const info = geminiModelInfo({ name: 'models/gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite', ...generate });
    expect(info.id).toBe('gemini-2.5-flash-lite');
    expect(info.displayName).toBe('Gemini 2.5 Flash-Lite');
    expect(info.compatibility).toBe('compatible');
  });
});

describe('OpenAI capability filtering', () => {
  it('accepts current and future chat-multimodal families without a frozen catalog', () => {
    for (const id of ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-5-mini', 'gpt-5.2', 'o3', 'o4-mini', 'chatgpt-4o-latest']) {
      expect(isOpenAiModelCandidate({ id })).toBe(true);
    }
  });

  it('rejects clearly unsuitable model categories', () => {
    for (const id of [
      'whisper-1',
      'tts-1-hd',
      'gpt-4o-audio-preview',
      'gpt-4o-realtime-preview',
      'gpt-4o-transcribe',
      'dall-e-3',
      'gpt-image-1',
      'text-embedding-3-small',
      'omni-moderation-latest',
      'davinci-002',
      'babbage-002',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-instruct',
      'gpt-4o-search-preview',
      'codex-mini-latest',
      'sora-2',
    ]) {
      expect(isOpenAiModelCandidate({ id })).toBe(false);
    }
  });

  it('produces friendly display names while retaining exact IDs', () => {
    expect(openAiFriendlyName('gpt-4.1-mini')).toBe('GPT-4.1 mini');
    expect(openAiFriendlyName('gpt-5-mini')).toBe('GPT-5 mini');
    expect(openAiFriendlyName('gpt-4o')).toBe('GPT-4o');
  });
});

describe('default model heuristic', () => {
  const model = (id: string, compatibility: AiModelInfo['compatibility'] = 'compatible'): AiModelInfo => ({
    id,
    displayName: id,
    provider: 'gemini',
    compatibility,
    capabilityHint: null,
    lastValidatedAt: null,
  });

  it('prefers the low-cost low-latency tier from whatever is currently available', () => {
    expect(pickDefaultModel([model('gemini-2.5-pro'), model('gemini-2.5-flash'), model('gemini-2.5-flash-lite')])).toBe(
      'gemini-2.5-flash-lite'
    );
    expect(pickDefaultModel([model('gpt-4.1'), model('gpt-4.1-nano'), model('gpt-4.1-mini')])).toBe('gpt-4.1-nano');
  });

  it('falls back to any usable model and never picks incompatible ones', () => {
    expect(pickDefaultModel([model('gemini-2.5-pro')])).toBe('gemini-2.5-pro');
    expect(pickDefaultModel([model('gpt-4o', 'incompatible')])).toBeNull();
    expect(pickDefaultModel([])).toBeNull();
  });
});

describe('provider error classification', () => {
  it('classifies model-gone responses as AI_MODEL_UNAVAILABLE', () => {
    expect(classifyProviderHttpError(404, 'The model `gemini-1.0-pro-vision` was not found')).toBe('AI_MODEL_UNAVAILABLE');
    expect(classifyProviderHttpError(400, '{"error":{"code":"model_not_found"}}')).toBe('AI_MODEL_UNAVAILABLE');
    expect(classifyProviderHttpError(400, 'The model gpt-4-vision-preview has been deprecated')).toBe('AI_MODEL_UNAVAILABLE');
  });

  it('keeps distinct codes for auth, rate limits, and generic bad requests', () => {
    expect(classifyProviderHttpError(401, 'unauthorized')).toBe('AI_AUTH_FAILED');
    expect(classifyProviderHttpError(429, 'rate limit')).toBe('AI_RATE_LIMITED');
    expect(classifyProviderHttpError(400, 'invalid request payload')).toBe('AI_MODEL_UNSUPPORTED');
    expect(classifyProviderHttpError(500, 'server error')).toBe('AI_PROVIDER_ERROR');
  });
});
