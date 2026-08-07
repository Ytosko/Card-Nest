# Card Nest implementation plan

This plan follows `HANDOFF.md`, which is the product and engineering source of truth.

## Audit baseline

- Existing app: Expo SDK 54, React Native 0.81, React 19.1, TypeScript strict mode, and Expo Router.
- Health: Expo Doctor passes all checks before implementation.
- Workflow: preserve Expo Go compatibility by using Expo SDK modules and React Native libraries supported by the managed workflow.
- Brand source: preserve `logos/logo.png`, `logos/logo.svg`, and `logos/fav.png`; generate platform assets into `assets/images/`.
- Security: only `EXPO_PUBLIC_*` values may be imported by mobile code. Supabase admin, database, SMTP, and Postmark values remain tooling-only.
- Design direction: token-driven flat design, spacious layout, high contrast, light/dark support, visible interaction states, and 44–48 point touch targets. Card Nest cyan `#0CC0DF` overrides generic palette suggestions.

## Phase 1 — Foundation

1. Protect local environment files and provide a safe `.env.example`.
2. Add startup/tooling environment validation that exposes only mobile-safe configuration.
3. Install SDK-compatible foundation dependencies for Supabase, persistent SQLite storage, network state, secure local secrets, Zustand, TanStack Query, and runtime validation.
4. Define primitive and semantic design tokens for light and dark themes.
5. Generate and configure branded icon, adaptive icon, splash, and favicon assets from the supplied logo.
6. Establish feature-oriented source folders, providers, shared UI primitives, and a branded runnable app shell.
7. Add explicit typecheck, test, environment validation, and aggregate check scripts.
8. Add baseline unit tests for environment contracts and the versioned feature-entitlement policy.

## Phase 2 — Supabase

1. Initialize Supabase CLI metadata and link the supplied hosted project using local credentials.
2. Inspect remote migration history before applying changes.
3. Add an additive initial migration containing:
   - user profiles and preferences;
   - normalized cards, email addresses, phone numbers, websites, addresses, tags, card images, and processing jobs;
   - constraints, update triggers, search helpers, and collection-scale indexes;
   - RLS on every user-owned table;
   - a private `card-images` Storage bucket with per-user path policies.
4. Dry-run and apply pending migrations to the linked project.
5. Generate TypeScript database types from the hosted schema.
6. Configure a typed Supabase client with durable Expo SQLite-backed session storage and foreground token refresh.
7. Add verification queries/tests for schema shape, RLS enablement, policies, indexes, and Storage privacy.

## Phase 3 — Authentication

1. Add a persistent Supabase session provider and guarded Expo Router groups.
2. Implement branded sign-up, sign-in, confirmation/resend, forgot/reset-password, home, and account/profile screens.
3. Handle Card Nest custom-scheme, Expo Go, and local-web auth callbacks, including implicit and PKCE-style payloads.
4. Configure hosted email confirmation, Postmark SMTP, redirect URLs, password policy, and five branded HTML templates through trusted tooling.
5. Publish the supplied logo as a read-only transactional-email asset while keeping original card images private.
6. Verify hosted confirmation enforcement, password auth, session issuance, profile provisioning/RLS, profile updates, sign-out, and configuration drift.

## Later phases

- Phase 4: card library, details, editing, deletion, pagination, and search.
- Phase 5: camera capture, image preparation, durable offline queue, upload, and sync status.
- Phase 6: SecureStore BYOK settings, dynamic provider models, schema-constrained extraction, and review.
- Phase 7: duplicate scoring and explicit merge/keep-both UX.
- Phase 8: single and bulk native Contacts export with progress and duplicate awareness.
- Phase 9: retry recovery, poor-network behavior, and conflict handling.
- Phase 10: accessibility, performance, release polish, privacy, and device verification.

## Phase completion gates

Each phase must keep the app runnable and pass the checks appropriate to its scope. No camera, Contacts, or full offline-sync milestone will be marked complete without real-device verification in its corresponding phase.
