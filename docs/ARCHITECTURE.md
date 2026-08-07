# Architecture

## System boundaries

Card Nest is a single Expo SDK 54 application for Android and iOS. Supabase is the durable cloud source of truth; Expo SQLite is the durable device queue/cache; Expo SecureStore is reserved for user-supplied AI API keys.

```text
Expo Router screens
  -> feature modules and shared UI
  -> TanStack Query / Zustand
  -> typed Supabase client ----> Auth / Postgres / private Storage
  -> Expo SQLite --------------> pending captures, retries, local cache
  -> Expo SecureStore ---------> user OpenAI or Gemini key only
```

## Source layout

- `app/`: route composition only. Business logic should stay in `src/features` or `src/lib`.
- `src/components`: reusable, accessible UI primitives and brand components.
- `src/config`: explicit public environment parsing. It must never read server-only names.
- `src/features`: product modules, grouped by capability rather than technical layer.
- `src/lib/supabase`: typed client, query helpers, and private Storage contracts.
- `src/providers`: process-wide providers with stable instances.
- `src/theme`: the only source of design colors, spacing, radii, sizes, and typography.
- `src/types`: generated database types and ergonomic helper aliases.

## Data ownership

All user-owned database tables carry `user_id`. Related card tables use composite foreign keys `(card_id, user_id)` so a row cannot point at another user's card even if application validation fails. RLS independently requires `auth.uid() = user_id`.

`user_entitlements` is readable by its owner but not client-writable. A missing or unknown entitlement safely leaves current open-source features enabled; an explicit supported `disabled` policy can restrict access.

## Session persistence

The Supabase client uses the Expo SQLite `localStorage` polyfill, URL polyfills, `processLock`, persistent refresh tokens, and foreground-aware auto-refresh. This keeps the solution within the Expo Go-compatible SDK 54 path.

## Design system

The interface follows Card Nest cyan `#0CC0DF`, a flat high-contrast visual language, a 4/8-point spacing rhythm, minimum 48-point controls, visible pressed/disabled states, safe-area-aware layouts, and paired light/dark semantic tokens. Poppins is used for headings and Open Sans for body copy.

## Phase boundaries

Phase 1–2 provide the validated shell and backend foundation. Auth, library UI, camera capture, offline synchronization, AI extraction, duplicates, and Contacts integration are intentionally implemented in the phased order in `docs/IMPLEMENTATION_PLAN.md`; unfinished capabilities must not be represented by fake production actions.
