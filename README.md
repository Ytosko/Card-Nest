# Card Nest

Card Nest is an open-source, AI-powered business card scanner, cloud contact library, and organizer for Android and iOS. This repository contains the mobile application, production website, hosted Supabase backend definition, tests, assets, and deployment configuration.

The mobile app uses Expo and strict TypeScript. Supabase is the hosted cloud source of truth, Expo SQLite provides durable device state, and Supabase Storage keeps original card images private. The production website is a separate Next.js application under `web/`.

## Repository applications

### Mobile app

The repository root is the Expo SDK 54 application for Android, iOS, Expo Go, and development web previews. It contains the authenticated product, camera capture, card library, offline queue, BYOK AI extraction, and contact export.

### Production website

`web/` is the standalone production website and authenticated Card Nest web application deployed at [cardnest.ytosko.dev](https://cardnest.ytosko.dev). It serves the public landing/legal pages plus `/app`, browser auth, shared contacts, capture, AI settings, exports, and the installable PWA shell.

### Hosted Supabase backend

`supabase/` contains forward migrations, RLS policies, Storage configuration, and branded Auth email templates for the hosted Supabase project. Docker Compose does not start Supabase or Postgres locally.

## Current implementation status

The Card Nest v1 implementation now includes:

- Expo SDK 54 and Expo Go-compatible foundation
- Card Nest branding, generated platform assets, light/dark tokens, and accessible UI primitives
- validated mobile/server environment boundary
- Zustand, TanStack Query, Zod, Expo SQLite, SecureStore, and Network foundations
- linked Supabase project with repository-owned migration history
- normalized card schema, search indexes, ownership constraints, RLS, and private card-image Storage
- generated TypeScript database types and typed Supabase client
- production-ready Card Nest sign-up, sign-in, confirmation, recovery, secure email change, profile, account deletion, and sign-out journeys
- persistent native/web sessions with guarded routing and confirmation/recovery deep links
- Postmark custom SMTP and five hosted Card Nest transactional-email templates
- first-party production auth verification through `cardnest.ytosko.dev`, with token removal before verification
- animated reduced-motion-aware launch, onboarding, five-tab dashboard, profile photos, and settings
- card CRUD, full-text search, filters, favorites, tags, private-image restore, duplicate merge/keep-separate, copy/share/call/email actions
- front/back camera or gallery capture, compression, durable SQLite queue, reconnect/restart recovery, private Storage upload, and retry status
- encrypted OpenAI/Gemini BYOK credentials, dynamic provider model discovery, schema-validated multimodal extraction, and editable review across mobile and web
- authenticated desktop/mobile-responsive web app with browser-specific PIN lock, shared contacts, live camera/upload/paste capture, bulk actions, vCard/CSV export, and a privacy-safe PWA shell
- single and selected bulk native Contacts export
- user profile provisioning, private avatars, and server-side account deletion protected by owner RLS
- unit, type, lint, remote schema, and Storage checks

Real-device and store-release validation remain tracked in [the release checklist](docs/RELEASE_CHECKLIST.md). See [the implementation plan](docs/IMPLEMENTATION_PLAN.md) for delivered phases.

## Requirements

- Node.js 20.19 or newer (Node 22 is supported)
- npm
- Expo Go for device development
- a Supabase project for cloud features
- Docker Desktop only for the optional local Supabase stack

## Mobile development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure the required values. Only `EXPO_PUBLIC_*` values may be read by mobile code.

3. Validate configuration:

   ```bash
   npm run env:check
   ```

4. Start Expo:

   ```bash
   npm start
   ```

Scan the QR code with Expo Go, or use the Android/iOS development commands from the Expo terminal.

## Website development

Install and start the website independently:

```bash
npm ci --prefix web
npm run web:dev
```

The development site is available at `http://localhost:3000`. Validate the production build with:

```bash
npm run web:check
```

The website requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` at runtime. Supabase access is performed through server-rendered routes/actions and secure cookies, so normal web UI and API calls stay on the Card Nest origin. These are public client credentials, not administrative secrets; RLS remains the authorization boundary. Local Compose automatically falls back to the matching `EXPO_PUBLIC_SUPABASE_*` values in the ignored root `.env`.

See [the web application guide](docs/WEB_APP.md) for routes, browser PIN security, AI credential boundaries, capture, exports, and PWA behavior.

## Docker deployment

The root Compose stack contains only the production website. It uses a multi-stage standalone Next.js build and does not run a development server, Metro, Expo, Supabase, or Postgres.

Before a production deployment, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` on the web service. Never provide a service-role key to the website.

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(async r => { console.log(await r.text()); if (!r.ok) process.exit(1) })"
docker compose down
```

Coolify should read `/docker-compose.yml` from the repository root and attach `https://cardnest.ytosko.dev:3000` to the `web` service. See [the complete Coolify deployment guide](docs/COOLIFY_DEPLOYMENT.md).

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run check
npm run db:verify
npm run auth:verify
npm run auth:flow-verify
npm run auth:web-flow-verify
npm run auth:production-verify
npm run web:check
```

Database types are generated from the linked hosted project:

```bash
npm run db:types
```

Brand assets are derived from the preserved source logo:

```bash
npm run assets:brand
```

## Repository map

- `app/` — Expo Router entry points
- `web/` — production Next.js website and container image
- `docker-compose.yml` — one-service production website stack for Coolify
- `src/components/` — shared branded UI
- `src/config/` — mobile-safe environment contracts
- `src/features/` — feature-owned application modules
- `src/lib/supabase/` — typed client and Storage path contracts
- `src/theme/` — primitive and semantic design tokens
- `src/types/database.types.ts` — generated hosted-schema types
- `supabase/migrations/` — database and Storage source of truth
- `docs/` — architecture and operating documentation
- `logos/` — preserved source brand assets

## Security

- `.env` and local Supabase state are ignored by Git.
- Server/admin credentials are tooling-only and never imported by Expo code.
- User OpenAI/Gemini API keys are encrypted by a Supabase Edge Function and decrypted only in trusted extraction/model-discovery memory. Plaintext keys are never returned to browser JavaScript.
- The mobile app uses a public Supabase key; authorization is enforced with RLS.
- Original card images are private and stored under owner-prefixed object paths.

See [Supabase operations](docs/SUPABASE.md) and [architecture](docs/ARCHITECTURE.md) for details.
See [authentication operations](docs/AUTHENTICATION.md) for hosted Auth, Postmark, email templates, and deep links.
See [Coolify deployment](docs/COOLIFY_DEPLOYMENT.md) for the exact GitHub-to-production setup.
