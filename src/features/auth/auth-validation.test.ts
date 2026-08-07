import { describe, expect, it } from 'vitest';

import { getFieldErrors, normalizeEmail, resetPasswordSchema, signInSchema, signUpSchema } from './auth-validation';

describe('authentication validation', () => {
  it('normalizes email casing and whitespace', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
  });

  it('requires valid sign-in credentials', () => {
    const result = signInSchema.safeParse({ email: 'not-an-email', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getFieldErrors(result.error)).toMatchObject({
        email: 'Enter a valid email address.',
        password: 'Enter your password.',
      });
    }
  });

  it('rejects short and mismatched sign-up passwords', () => {
    const result = signUpSchema.safeParse({
      displayName: 'A user',
      email: 'user@example.com',
      password: 'short',
      confirmPassword: 'different',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getFieldErrors(result.error)).toMatchObject({
        password: 'Use at least 8 characters.',
        confirmPassword: 'Passwords do not match.',
      });
    }
  });

  it('accepts matching reset passwords', () => {
    expect(resetPasswordSchema.safeParse({ password: 'long-enough', confirmPassword: 'long-enough' }).success).toBe(true);
  });
});
