import { describe, expect, it } from 'vitest';

import { parsePublicEnv } from './env';

const validInput = {
  EXPO_PUBLIC_APP_NAME: 'Card Nest',
  EXPO_PUBLIC_APP_ENV: 'development',
  EXPO_PUBLIC_APP_SCHEME: 'cardnest',
  EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-key-with-enough-length',
};

describe('public environment contract', () => {
  it('accepts mobile-safe Supabase configuration', () => {
    expect(parsePublicEnv(validInput).success).toBe(true);
  });

  it('rejects an insecure Supabase URL', () => {
    expect(
      parsePublicEnv({ ...validInput, EXPO_PUBLIC_SUPABASE_URL: 'http://example.supabase.co' }).success,
    ).toBe(false);
  });

  it('rejects missing publishable credentials', () => {
    expect(parsePublicEnv({ ...validInput, EXPO_PUBLIC_SUPABASE_ANON_KEY: '' }).success).toBe(false);
  });
});
