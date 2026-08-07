# Card Nest authentication

Card Nest uses Supabase Auth with email/password accounts, mandatory confirmation, password recovery, secure email change, persistent sessions, and user-owned profiles.

## App routes

- `/sign-in` — password sign-in with confirmation-aware errors
- `/sign-up` — account creation with optional display name
- `/verify-email` — confirmation waiting state and resend action
- `/forgot-password` — enumeration-safe reset request
- `/auth/callback` — confirmation/recovery deep-link handoff
- `/reset-password` — authenticated recovery session and password update
- `/(app)/(tabs)/index` — authenticated dashboard entry
- `/profile` — photo/details, secure email change, sign-out, and account deletion

`AuthProvider` restores the persisted Supabase session, listens for auth events, refreshes the matching profile, and supplies guarded route state. Native builds use Expo SQLite-backed local storage. Web uses browser local storage with an in-memory static-render fallback.

## First-party links

The stable production scheme is `cardnest://auth/callback`. The public web callback and hosted Site URL are both `https://cardnest.ytosko.dev/auth/callback` / `https://cardnest.ytosko.dev`.

Every transactional email links directly to the Card Nest domain with a one-time token hash. The page removes the token from browser history before making a same-origin POST to `/api/auth/verify`. That server route verifies with the public anon/publishable key; the browser is never navigated to a Supabase hostname. A returned session is handed to the installed app through the custom scheme. Recovery sessions continue to the reset-password screen.

Expired, already-used, malformed, rate-limited, and temporarily unavailable links stay on the branded Card Nest page with safe messages. Email-change approvals may return no session; the app opens normally and restores any existing session.

`Linking.createURL()` supplies the active Expo Go callback in development. Hosted Auth allows the stable Card Nest scheme, Expo Go callbacks, the production web callback, and documented local callback ports.

## Hosted Auth and Postmark

All server credentials remain in ignored `.env` values and are read only by tooling. They are never imported by mobile or web application code.

The hosted configuration enables:

- email/password sign-up with confirmation
- secure double confirmation for email changes
- minimum 8-character passwords
- Postmark-backed custom SMTP with Card Nest sender name
- Card Nest callback allow-list entries
- branded confirmation, recovery, email-change, magic-link, and invite templates

Templates are repository-owned under `supabase/templates/`. The public `brand-assets` bucket contains only the supplied email logo; original card images and profile avatars remain private.

```bash
npm run auth:configure
npm run auth:verify
npm run auth:flow-verify
npm run auth:web-flow-verify
npm run auth:production-verify
npm run security:verify-bundle
```

`auth:verify` checks SMTP metadata, redirects, confirmation settings, and exact first-party template contents. `auth:flow-verify` tests session/profile behavior with a disposable account. `auth:web-flow-verify` tests the local production callback bridge.

`auth:production-verify` exercises signup, recovery, magic link, invitation, malformed/reused tokens, and secure two-address email change against the live Card Nest domain. Email-change messages use Postmark's documented black-hole test address and are read through its server API; the script never prints recipients, token hashes, sessions, or credentials.

After `npx expo export --platform web`, `security:verify-bundle` scans generated output for configured service-role, database, SMTP, and Postmark values and reports only credential names if a leak is detected.

## Deliverability

Postmark link tracking must remain disabled for authentication emails because rewritten links can break verification. DKIM, SPF, DMARC, sender-domain approval, and production inbox placement should be checked before public release.
