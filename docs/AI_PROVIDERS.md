# AI providers

AI extraction is scheduled for Phase 6. This document records the security and data contract established by the handoff so implementation does not drift.

## Provider model

- Supported providers: OpenAI and Google Gemini.
- The user supplies and owns the provider API key.
- Keys are stored locally in Expo SecureStore and are never uploaded to Supabase.
- Provider model lists are fetched dynamically and cached for usability; no hard-coded list is authoritative.
- Non-secret provider/model preferences may be stored in `user_preferences`.

## Extraction contract

The provider response must be schema-constrained and runtime-validated before it reaches the database. It will cover names, organization, title, multiple phones/emails/websites/addresses, printed social URLs, notes, raw transcription, and uncertainty metadata.

Front and back images should be supplied together when the selected model supports multi-image vision. Prompts must prohibit invention, preserve international formatting and company spelling, distinguish printed contact labels, and return empty values for unknown fields.

Every extracted field remains editable in the review flow. Provider output is untrusted input; it is never saved directly without validation.
