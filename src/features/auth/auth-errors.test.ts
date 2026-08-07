import { describe, expect, it } from 'vitest';

import { getAuthErrorMessage } from './auth-errors';

describe('authentication error messages', () => {
  it.each([
    [{ message: 'Invalid login credentials', code: 'invalid_credentials' }, 'The email or password is incorrect.'],
    [{ message: 'Email not confirmed', code: 'email_not_confirmed' }, 'Confirm your email before signing in.'],
    [{ message: 'Email address already confirmed' }, 'This email is already confirmed. Sign in to continue.'],
    [{ message: 'Network request failed' }, 'Card Nest cannot reach the server. Check your connection and try again.'],
    [{ message: 'Email rate limit exceeded', status: 429 }, 'Too many attempts. Wait a little before trying again.'],
  ])('maps provider errors to useful copy', (error, expected) => {
    expect(getAuthErrorMessage(error)).toBe(expected);
  });
});
