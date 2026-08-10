/**
 * Google Sign-In is fully implemented (mobile buttons, Supabase provider, web
 * /gauth/callback relay) but hidden from the UI until Google OAuth brand
 * verification completes. Flip to true to re-enable the buttons — no other
 * changes are required.
 */
export const GOOGLE_SIGN_IN_ENABLED = true;

/**
 * Passkey authentication is hidden/disabled per user request.
 */
export const PASSKEY_ENABLED = false;

