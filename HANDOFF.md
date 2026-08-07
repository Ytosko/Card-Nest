# Card Nest — Product & Engineering Handoff

## 0. Mission

Build **Card Nest**, a polished Android + iOS app for scanning, organizing, searching, backing up, and exporting physical business cards.

The product should let a user photograph the front and back of a business card, extract structured contact information with the user's own AI provider/API key, store the original images and normalized data in the cloud, detect duplicates, search everything quickly, and optionally export one or all records to the native phone Contacts app.

This is intended to become a real, releasable product — not a demo.

---

## 1. Non-negotiable product principles

1. **One codebase for Android and iOS.**
2. **Cloud is the source of truth.**
   - If the phone is lost, the user can sign in on a new phone and recover all cards and extracted data.
3. **Offline capture must still work.**
   - When offline, captures are queued locally and uploaded/processed automatically when connectivity returns.
4. **Original card images are always retained** unless the user explicitly deletes them.
5. **No fake/demo implementations in production paths.**
6. **No hard-coded AI model lists.**
   - Fetch available models from the selected provider whenever practical and cache the result for usability.
7. **User owns their AI usage.**
   - The user selects OpenAI or Gemini and supplies their own API key in Settings.
8. **Secrets must never be committed to Git.**
9. **Mobile app must never contain server-only secrets** such as the Supabase service-role key.
10. **Every meaningful feature must be testable on a real device.**
11. Keep architecture clean and modular, but avoid unnecessary over-engineering.
12. Prefer strict TypeScript and explicit data contracts.

---

## 2. Brand

### Product name
**Card Nest**

### Primary brand color
`#0CC0DF`

Build a small tokenized palette around it. Suggested starting point:

- `brand.500`: `#0CC0DF`
- `brand.600`: derive a darker pressed/active shade
- `brand.100`: derive a light background/tint shade
- `surface`: near-white
- `surfaceDark`: near-black
- `textPrimary`: high-contrast neutral
- `textSecondary`: muted neutral
- `success`: distinct green
- `warning`: distinct amber
- `danger`: distinct red
- `info`: brand-derived blue/cyan

Do not scatter raw color literals through components. Use theme tokens.

### Logo
The owner has provided the Card Nest logo asset. Use it to replace Expo defaults for:

- app icon
- adaptive Android icon
- splash screen
- in-app auth/branding
- favicon/web preview where appropriate

Preserve the source logo. Generate platform-specific assets from it rather than modifying the only source copy.

### Design direction
Modern, premium, clean, friendly, spacious, fast.

Use the installed **UI/UX Pro Max skill** as a design aid during implementation. It is not an app dependency.

Avoid:
- generic template look
- excessive gradients
- excessive glassmorphism
- tiny tap targets
- clutter
- inconsistent spacing
- placeholder illustrations

---

## 3. Chosen stack

### Mobile
- React Native
- Expo
- TypeScript
- Expo Router

### State / data
- Zustand for lightweight app/UI state
- Supabase JS client for cloud data
- SQLite for offline queue/cache
- React Query / TanStack Query is allowed and recommended for remote server state if it materially simplifies caching/invalidation

### Expo modules
Use current Expo-compatible packages for:
- camera
- image picker if useful
- file system
- secure storage
- contacts
- network/connectivity
- notifications only when/if required
- linking
- sharing
- haptics

Prefer Expo-supported modules before adding custom native dependencies.

### Backend
**Supabase**
- Auth
- Postgres
- Storage
- Row Level Security
- Edge Functions only where a trusted server environment is actually needed

### Email
**Postmark via Supabase SMTP**
Use custom branded HTML email templates instead of Supabase defaults.

### AI
User-configurable BYOK:
- OpenAI
- Google Gemini

Store the user's selected provider and API key locally in Expo SecureStore.

Never upload the user's AI API key to Supabase unless a future product decision explicitly changes this.

---

## 4. Important security boundary

There are two categories of environment values:

### Safe-to-bundle client configuration
Only values prefixed with `EXPO_PUBLIC_` may be accessed by the Expo app.

Examples:
- Supabase project URL
- Supabase publishable/anon key

These are not treated as secrets; security comes from RLS.

### Server/admin secrets
These must never be referenced by React Native code and must never be bundled into the app:
- Supabase service-role key
- Supabase access token
- Supabase DB password
- Postmark server token
- SMTP password
- any future private backend secret

If a variable is server-only, isolate its usage in:
- Supabase CLI
- migrations
- scripts
- Edge Functions
- trusted local tooling

Add checks so importing server-only env into mobile code is difficult/impossible.

---

## 5. Codex owns Supabase end-to-end

The coding agent is expected to operate Supabase itself.

The owner should not be required to:
- manually write SQL in the dashboard
- manually create tables
- manually create RLS policies
- manually create buckets
- manually deploy Edge Functions
- manually copy/paste migrations
- manually configure schema changes

Codex should use the Supabase CLI and repository migrations as the source of truth.

### Codex responsibilities
- initialize Supabase local project metadata if needed
- link the repository to the supplied Supabase project
- create and maintain migrations
- apply migrations
- create/update Storage buckets
- create RLS policies
- create database indexes
- create functions/triggers if needed
- deploy Edge Functions if needed
- configure auth-related application settings that are exposed through supported CLI/API mechanisms
- keep generated schema/types synchronized with the database
- document anything that truly cannot be automated

### Owner responsibilities
Only intervene when:
- a credential must be supplied
- an external platform requires an interactive approval
- Apple/Google/Postmark/Supabase requires a web-dashboard action that has no safe automation path
- Codex needs explicit approval for a destructive operation

Before destructive database actions, Codex must clearly state what will be deleted or altered.

---

## 6. Authentication

Start with:
- email
- password
- email confirmation
- password reset

Use Supabase Auth.

Future social login can be added later without changing the core data model.

### Email branding
Use Postmark SMTP through Supabase.

Create custom Card Nest HTML templates for at least:
- confirm signup
- reset password
- change email
- magic link / OTP template if the feature is ever enabled
- invite template if admin invitation is ever used

The design should use the Card Nest logo, `#0CC0DF`, responsive email-safe HTML, clear CTA buttons, and plain-text-safe wording.

Do not rely on the stock Supabase visual templates.

---

## 7. Core user journeys

### A. First launch
1. Branded splash
2. Welcome/onboarding
3. Sign up or sign in
4. Email verification if required
5. Land on Home

### B. Add a business card
1. Tap prominent Scan button
2. Capture front
3. Prompt to capture back or skip
4. Show preview
5. Save capture immediately to local queue
6. If online:
   - upload originals to Supabase Storage
   - process with configured AI provider
7. If offline:
   - show "Waiting for connection"
   - automatically resume later
8. Parse structured fields
9. Show an editable review screen
10. Run duplicate detection
11. Save/merge based on user choice
12. Display completed card/contact record

### C. Restore on another phone
1. Install Card Nest
2. Sign in
3. All cloud records and card images become available
4. Local search index/cache repopulates as needed

### D. Search
Support fast search over:
- name
- company
- job title
- phone
- email
- address
- website
- tags
- notes
- extracted raw text

### E. Contact actions
From a record:
- call
- SMS
- email
- open website
- copy any field
- share contact
- export to native Contacts
- edit
- delete

### F. Bulk export
Provide an explicit action to export all Card Nest contacts to the device Contacts app.

Show progress and a useful result summary.

Never silently write hundreds/thousands of contacts without an explicit user action.

---

## 8. Contact data model

Design a normalized schema, but a practical first version may use a main `cards` table plus related tables where useful.

Minimum logical fields:

### cards
- id UUID
- user_id UUID
- created_at
- updated_at
- status
- display_name
- first_name
- middle_name
- last_name
- company
- job_title
- department
- primary_email
- primary_phone
- website
- address_line_1
- address_line_2
- city
- state_region
- postal_code
- country
- notes
- raw_extracted_text
- extraction_provider
- extraction_model
- extraction_confidence or quality metadata where available
- source_front_image_path
- source_back_image_path
- source_hash / fingerprint
- duplicate_of_id nullable
- last_exported_to_contacts_at nullable

Consider related tables for:
- emails
- phone_numbers
- websites
- addresses
- tags
- card_images
- processing_jobs

Choose the structure that best supports multiple phone numbers/emails without creating an awkward UI.

### Every user-owned row must have RLS
A user must only be able to read/write rows belonging to their own `auth.uid()`.

No cross-user card visibility.

---

## 9. Storage model

Create a private Supabase Storage bucket for card images.

Recommended organization:
`cards/{user_id}/{card_id}/front.<ext>`
`cards/{user_id}/{card_id}/back.<ext>`

Enforce ownership through Storage policies.

Do not use a public bucket for original business-card images.

Generate signed URLs only when needed.

Consider client-side image resizing/compression before upload while preserving legibility.

---

## 10. Offline architecture

Cloud remains source of truth, but the app must be resilient offline.

Use SQLite for:
- pending captures
- pending uploads
- pending extraction jobs
- local cached card summaries
- retry metadata
- sync timestamps

Each queue item should have:
- local id
- type
- payload
- created_at
- retry_count
- last_error
- next_retry_at
- status

Required states:
- queued
- uploading
- processing
- synced
- failed

Implement safe retry with backoff.

Never lose a newly captured card because the user lost connectivity or force-closed the app.

---

## 11. AI provider settings

Create Settings > AI.

User can choose:
- OpenAI
- Gemini

For each provider:
- API key field
- test/validate key
- dynamic model list
- selected model
- clear/remove key

Store API keys in Expo SecureStore.

Store non-secret preferences such as selected provider/model in normal app storage and/or user profile.

### Dynamic models
Do not maintain a hard-coded list as the authoritative list.

Fetch from the provider's model-list endpoint when supported.

Filter the provider response to models that can reasonably accept the required input.

Cache a recently fetched list for usability and provide Refresh.

### Extraction contract
AI output must be schema-constrained.

Expected JSON shape should cover at least:
- person name
- organization
- title
- phones[]
- emails[]
- websites[]
- addresses[]
- social/profile URLs if explicitly printed
- notes
- raw transcription
- confidence/uncertain fields when possible

Validate AI JSON before saving.

Never directly trust arbitrary model output.

---

## 12. Image processing / extraction

The app should pass front and back images together when the chosen model supports multi-image vision.

Prompt the model to:
- transcribe accurately
- not invent missing values
- preserve international phone formatting
- distinguish fax/phone/mobile where printed
- distinguish personal vs business email when clear
- preserve company spelling
- return null/empty for unknown values
- flag uncertain OCR rather than hallucinating

The review screen must allow the user to correct every extracted field before final save.

---

## 13. Duplicate detection

Detect likely duplicates before creating a new permanent record.

Use layered matching, e.g.:
1. exact normalized email
2. exact normalized phone
3. same source image hash
4. strong name + company match
5. strong name + title/company + contact overlap

Never auto-merge ambiguous records without the user knowing.

When duplicate confidence is high, show:
- existing record
- new extracted fields
- Merge
- Keep both
- Cancel

A repeated scan of the exact same card should be detected quickly.

---

## 14. Native Contacts integration

Use Expo-compatible Contacts APIs.

Capabilities:
- export one Card Nest record
- export all Card Nest records
- request permission only when the user invokes the feature or when an appropriately contextual flow requires it
- map all supported fields cleanly
- avoid duplicate native contact creation where practical

Track native-export metadata in Card Nest so repeated bulk export can be handled intelligently.

Do not promise OS-level WhatsApp/Facebook contact badges. Those are outside Card Nest's control.

---

## 15. Search and organization

Home should make thousands of cards manageable.

Recommended sections:
- Search
- Recently added
- Favorites
- Tags
- Companies
- All cards

Search should feel instant.

Possible filters:
- company
- tag
- country/city
- date added
- has email
- has phone
- favorites

Implement pagination/infinite loading so large collections remain fast.

---

## 16. Suggested screens

Use Expo Router groups/layouts sensibly.

Minimum:
- Splash
- Onboarding
- Sign in
- Sign up
- Forgot password
- Verify email state
- Home
- Search
- Scan camera
- Capture preview
- Processing
- Review extracted details
- Duplicate comparison
- Contact/card detail
- Edit card
- Native export confirmation/progress
- Settings
- AI provider settings
- Account/profile
- About / privacy
- Sync status / failed jobs view

A bottom-tab layout is acceptable, for example:
- Home
- Search
- Scan
- Cards
- Settings

The Scan affordance should be visually dominant.

---

## 17. Feature gate for future monetization

Build a lightweight capability/entitlement layer now even though the app is initially free/open source.

Do not hard-code "everything is forever free" into UI logic.

Implement a central function/hook such as:
`canUseFeature(featureKey)`

Initial behavior:
- all current core features enabled for normal users

Design it so a future backend entitlement can return:
- free
- pro
- team
- disabled

Possible feature keys:
- scan_card
- cloud_backup
- ai_extraction
- bulk_export
- advanced_search
- unlimited_cards
- custom_tags

Important:
The gate must not accidentally lock all existing open-source users merely because the monetization backend is unavailable.

Use safe defaults and versioned policy.

---

## 18. Open-source readiness

Repository should be clean enough to publish.

Required:
- useful README
- `.env.example`
- migrations checked in
- no credentials in history
- clear setup commands
- license placeholder or selected license if owner specifies one
- contribution instructions can come later
- architecture documentation
- meaningful commit hygiene if Codex is committing

Never commit:
- `.env`
- service role keys
- Postmark tokens
- access tokens
- database password
- user's AI API keys

---

## 19. Quality bar

### TypeScript
Use strict mode.

Avoid `any` unless there is a documented reason.

### Error handling
Every network operation should have:
- loading state
- error state
- retry path where relevant

### Accessibility
- proper labels
- adequate contrast
- dynamic text where practical
- reasonable touch targets
- do not communicate state by color alone

### Performance
- compress large images
- lazy-load thumbnails
- paginate lists
- avoid downloading full-resolution originals for list views
- memoize only when useful, not mechanically

### Privacy
Business cards contain personal data.

Implement:
- private storage
- RLS
- delete account flow
- delete card flow
- clear language around cloud backup
- no analytics/telemetry SDK unless intentionally chosen

---

## 20. Testing

At minimum:

### Unit tests
- normalization utilities
- duplicate scoring
- AI response validation
- feature gate logic
- offline queue state transitions

### Integration tests
- auth session handling
- Supabase CRUD
- RLS assumptions where practical
- queued capture → upload → synced record

### Device checks
Before calling a milestone done, verify on a real Expo device where supported:
- sign in
- camera
- scan
- offline queue
- upload
- AI extraction
- Contacts permission/export
- restore after sign-out/sign-in

Do not mark camera/contact features complete based only on web/simulator behavior.

---

## 21. Implementation order

Codex should execute in this sequence and keep the app runnable after every phase.

### Phase 1 — Foundation
- inspect existing Expo project
- preserve working Expo Go compatibility where possible
- set up theme/tokens
- install required dependencies
- configure environment validation
- wire app logo/icon/splash
- set up folder architecture
- set up lint/typecheck/tests

### Phase 2 — Supabase
- link project using provided admin credentials
- create migrations
- schema
- indexes
- RLS
- Storage bucket/policies
- generate TS database types
- configure client

### Phase 3 — Auth
- sign up
- sign in
- confirm email state
- reset password
- persistent session
- sign out
- branded auth UI
- Postmark/Supabase email configuration where automatable

### Phase 4 — Card library UI
- home
- list
- card detail
- edit
- search
- deletion

### Phase 5 — Capture + cloud images
- camera
- front/back capture
- compression
- offline queue
- upload
- storage paths
- sync status

### Phase 6 — AI
- provider settings
- SecureStore API keys
- validate API key
- dynamic models
- vision extraction
- schema validation
- review/edit screen

### Phase 7 — Duplicate handling
- exact matches
- fuzzy matching
- merge/keep-both UI

### Phase 8 — Native contacts
- single export
- bulk export
- progress
- duplicate-conscious behavior

### Phase 9 — Offline hardening
- retries
- queue recovery after restart
- poor-network scenarios
- conflict resolution

### Phase 10 — Polish/release readiness
- accessibility
- empty states
- animations/haptics used tastefully
- performance
- error copy
- settings/about/privacy
- release checklist

---

## 22. Required project documentation Codex should maintain

Create/update:
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/SUPABASE.md`
- `docs/AI_PROVIDERS.md`
- `docs/OFFLINE_SYNC.md`
- `docs/RELEASE_CHECKLIST.md`

Keep docs accurate as implementation changes.

---

## 23. Environment handling

A `.env.example` accompanies this handoff.

Codex must:
1. verify `.env` is gitignored
2. never print secrets into logs
3. validate required variables at startup/tooling time
4. keep server/admin environment usage out of the Expo bundle
5. use Expo public variables only for non-secret app configuration

---

## 24. First instruction to Codex

Start by auditing the existing Card Nest Expo project rather than replacing it.

Then:

1. Read this entire handoff.
2. Inspect the existing package versions and Expo SDK.
3. Keep the project compatible with the owner's currently working Expo Go setup unless a required feature genuinely forces a development build.
4. Inspect the supplied logo asset.
5. Create an implementation plan in the repo.
6. Configure `.gitignore` and environment validation.
7. Link and provision Supabase using the credentials supplied in `.env`.
8. Implement Phase 1 and Phase 2 first.
9. Run typecheck/tests after each meaningful change.
10. Do not ask the owner to perform SQL/dashboard work that the agent can do itself.

If a platform limitation blocks a requested feature, explain the limitation and implement the closest robust alternative instead of faking it.

---

## 25. Definition of done for Card Nest v1

A fresh user can:

- install/open Card Nest
- create an account
- verify email
- sign in
- configure OpenAI or Gemini with their own key
- dynamically choose a supported model
- photograph front/back of a business card
- keep that capture safe if currently offline
- automatically upload later
- extract structured data
- review/correct extracted details
- detect a duplicate
- save or merge
- search the library
- view original card images
- call/SMS/email from a record
- export one record to native Contacts
- export all records to native Contacts
- sign out
- sign in on another device
- recover their cloud-stored cards and data

That is the v1 target.
