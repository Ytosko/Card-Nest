# Architecture

## System boundaries

Card Nest is an Expo SDK 54 application for Android and iOS. Supabase is the durable cloud source of truth; Expo SQLite is the durable device queue/cache; Expo SecureStore is reserved for user-supplied AI API keys. The production website is an independently built Next.js service.

```text
Expo Router screens
  -> feature modules and shared UI
  -> TanStack Query
  -> typed Supabase client ----> Auth / Postgres / private Storage
  -> Expo SQLite --------------> pending captures, retries, session storage
  -> Expo SecureStore ---------> user OpenAI or Gemini key only

cardnest.ytosko.dev
  -> web Auth Route Handler -> PKCE/email verification -> secure SSR cookies
  -> mobile OAuth relay (/gauth/callback) -> cardnest:// deep link
```

## Source layout

- `app/`: route composition; business logic stays in `src/features` or `src/lib`.
- `src/components`: reusable, accessible UI primitives and brand components.
- `src/config`: explicit public environment parsing; it must never read server-only names.
- `src/features`: product modules grouped by capability.
- `src/lib/supabase`: typed client, session storage, and private Storage contracts.
- `src/providers`: process-wide providers with stable instances.
- `src/theme`: design colors, spacing, radii, sizes, and typography.
- `src/types`: generated database types and ergonomic aliases.
- `web/`: production site and first-party Auth verification bridge.
- `supabase/`: forward migrations, Auth templates, Storage policies, and Edge Functions.

## Data ownership

All user-owned database tables carry `user_id`. Related card tables use composite foreign keys `(card_id, user_id)` so a row cannot point at another user's card even if application validation fails. RLS independently requires `auth.uid() = user_id`.

`user_entitlements` is readable by its owner but not client-writable. A missing or unavailable entitlement fails open for current open-source features; an explicit supported policy can restrict access.

## Runtime flows

- Auth emails open only `https://cardnest.ytosko.dev/auth/callback`. The same-origin Route Handler verifies one-time hashes with the public anon key, persists the web session in secure cookies, and redirects to the appropriate first-party web destination.
- Web Google OAuth returns to `/auth/callback?next=/app`, where the PKCE code is exchanged before `/app` is requested. Mobile Google OAuth retains its separate `/gauth/callback` relay and `cardnest://` handoff.
- Camera/gallery captures are compressed and copied into application documents before SQLite accepts the queue row. The queue creates the cloud card, uploads private images, optionally runs device-keyed AI extraction, and preserves retry state.
- Cloud cards are queried through RLS-aware Supabase APIs. Private images use short-lived signed URLs and restore across devices after sign-in.
- OpenAI/Gemini keys never enter React Query, SQLite, Postgres, logs, or environment configuration. Only provider/model preferences synchronize.
- Account deletion is the only privileged product mutation and runs in an authenticated Edge Function; no service-role credential enters the Expo bundle.

## Session persistence

The Supabase client uses the Expo SQLite `localStorage` polyfill, URL polyfills, `processLock`, persistent refresh tokens, and foreground-aware auto-refresh. This remains within the Expo Go-compatible SDK 54 workflow.

## Design system

The interface follows Card Nest cyan `#0CC0DF`, a flat high-contrast visual language, a 4/8-point spacing rhythm, minimum 48-point controls, safe-area-aware layouts, paired light/dark tokens, and reduced-motion behavior. Poppins is used for headings and Open Sans for body copy. The implementation gate is `design-system/card-nest/MASTER.md`.
