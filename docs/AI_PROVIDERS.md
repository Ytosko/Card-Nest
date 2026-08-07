# AI providers

AI extraction is implemented in Phase 6. This document records its security and data contract.

## Provider model

- Supported providers: OpenAI and Google Gemini.
- The user supplies and owns the provider API key.
- Keys are stored locally in Expo SecureStore and are never uploaded to Supabase.
- Provider model lists are fetched dynamically from the authenticated OpenAI or Gemini account; no hard-coded list is authoritative.
- Non-secret provider/model preferences may be stored in `user_preferences`.

## Extraction contract

Provider responses are schema-constrained and runtime-validated before they reach the database. The contract covers names, organization, title, multiple phones/emails/websites, address fields, notes, raw transcription, and confidence metadata.

Front and back images should be supplied together when the selected model supports multi-image vision. Prompts must prohibit invention, preserve international formatting and company spelling, distinguish printed contact labels, and return empty values for unknown fields.

Every extracted field remains editable in the review flow. Provider output is untrusted input; it is never saved directly without validation. Extraction failures preserve the uploaded originals and route the card to review rather than discarding the capture.

OpenAI extraction uses the Responses API with image inputs and strict JSON Schema output. Gemini uses `generateContent` with inline image data, JSON MIME output, and the same schema. Provider errors are normalized so API keys and raw provider responses are never logged.
