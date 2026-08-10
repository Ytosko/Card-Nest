# Card Nest authentication

Card Nest uses Supabase Auth with email/password accounts, mandatory confirmation, password recovery, secure email change, persistent sessions, and user-owned profiles.

## App routes

- `/sign-in` — password sign-in with confirmation-aware errors
- `/sign-up` — account creation with optional display name
- `/verify-email` — confirmation waiting state and resend action
- `/forgot-password` — enumeration-safe reset request
- `/auth/callback` — web-only PKCE and email verification callback
- `/reset-password` — authenticated recovery session and password update
- `/(app)/(tabs)/index` — authenticated dashboard entry
- `/profile` — photo/details, secure email change, sign-out, and account deletion

`AuthProvider` restores the persisted Supabase session, listens for auth events, refreshes the matching profile, and supplies guarded mobile route state. Native builds use Expo SQLite-backed local storage. The production Next.js web application uses secure Supabase SSR cookies and server-side route guards independently of the Expo web preview.

## First-party links

The stable production scheme is `cardnest://auth/callback`. The public web callback and hosted Site URL are both `https://cardnest.ytosko.dev/auth/callback` / `https://cardnest.ytosko.dev`.

Every transactional email links directly to the Card Nest domain with a one-time token hash. The Next.js `/auth/callback` Route Handler verifies the hash server-side, stores the session in secure SSR cookies, and redirects only after that cookie write completes. Recovery sessions continue to the branded web reset page. The browser is never sent to a Supabase-hosted page for email confirmation or recovery.

Google OAuth remains a standards-based provider redirect. Users necessarily visit Google and the configured Supabase Auth authorization endpoint unless the project later receives a Supabase custom domain. Card Nest keeps the application callback and post-auth destination first-party and separates web `/auth/callback?next=/app` from the working mobile `/gauth/callback` relay. The web callback never constructs or follows a `cardnest://` URL; only the mobile relay owns that deep-link behavior.

The web callback exchanges PKCE authorization codes while the original code-verifier cookie is still available, requires the resulting Auth cookies to be writable, and then redirects to the allow-listed first-party `next` path. A Next.js 16 `proxy.ts` refreshes expiring sessions and mirrors rotated cookies to both Server Components and the browser. `/app` awaits the server-side `getUser()` result before deciding whether the account is authenticated. A missing or invalid session redirects to login, a transient Auth service failure shows a retry state without signing the user out, and an authenticated account proceeds to browser PIN loading/setup/unlock.

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
