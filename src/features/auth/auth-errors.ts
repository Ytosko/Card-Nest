type AuthErrorLike = { code?: string; message?: string; status?: number } | Error | null | undefined;

export function getAuthErrorMessage(error: AuthErrorLike, fallback = 'Something went wrong. Please try again.') {
  const code = 'code' in (error ?? {}) ? (error as { code?: string }).code : undefined;
  const status = 'status' in (error ?? {}) ? (error as { status?: number }).status : undefined;
  const message = error?.message?.toLowerCase() ?? '';

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'The email or password is incorrect.';
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Confirm your email before signing in.';
  }
  if (code === 'user_already_exists' || message.includes('already registered') || message.includes('already exists')) {
    return 'An account already exists for this email. Try signing in instead.';
  }
  if (message.includes('already confirmed')) {
    return 'This email is already confirmed. Sign in to continue.';
  }
  if (status === 429 || code === 'over_email_send_rate_limit' || message.includes('rate limit')) {
    return 'Too many attempts. Wait a little before trying again.';
  }
  if (code === 'weak_password' || message.includes('password should be')) {
    return 'Use a stronger password with at least 8 characters.';
  }
  if (code === 'same_password' || message.includes('different from the old password')) {
    return 'Choose a password you have not used for this account.';
  }
  if (message.includes('expired') || code === 'otp_expired') {
    return 'This link has expired. Request a new email and try again.';
  }
  if (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror')
  ) {
    return 'Card Nest cannot reach the server. Check your connection and try again.';
  }

  return fallback;
}
