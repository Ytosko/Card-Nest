# Card Nest authentication

Phase 3 uses Supabase Auth with email/password accounts, mandatory email confirmation, password recovery, persistent sessions, and a user-owned `profiles` row.

## App routes

- `/sign-in` — password sign-in with confirmation-aware error routing
- `/sign-up` — account creation with optional display name
- `/verify-email` — confirmation waiting state and resend action
- `/forgot-password` — enumeration-safe reset request
- `/auth/callback` — confirmation/recovery deep-link exchange for implicit and PKCE-style links
- `/reset-password` — authenticated recovery session and password update
- `/home` — authenticated app entry
- `/account` — profile editing and sign-out

The `AuthProvider` initializes from the persisted Supabase session, listens for auth state changes, refreshes the matching profile, and exposes signed-in state to route guards. Native builds use Expo SQLite-backed local storage. Web uses browser local storage and an in-memory fallback during static rendering.

## Deep links

The stable production scheme is:

```text
cardnest://auth/callback
```

The hosted web callback is `https://cardnest.ytosko.dev/auth/callback`, and the hosted Supabase Site URL is `https://cardnest.ytosko.dev`.

`Linking.createURL()` is used at runtime so Expo Go receives its current LAN callback URL. Hosted Auth allows the Card Nest scheme, Expo Go callbacks, and local web callback ports. Production and development builds should continue using the stable `cardnest` scheme configured in `app.json`.

## Hosted Auth and Postmark

All server credentials remain in ignored `.env` values and are read only by local tooling. They are never imported by `app/` or `src/` application code.

The hosted configuration enables:

- email/password sign-up with email confirmation
- secure double confirmation for email changes
- minimum 8-character passwords
- Postmark-backed custom SMTP
- Card Nest callback allow-list entries
- branded confirmation, recovery, email-change, magic-link, and invite templates

The templates are repository-owned under `supabase/templates/`. A public `brand-assets` Storage bucket contains only the supplied Card Nest email logo; original business-card images remain in the private `card-images` bucket.

Apply and verify hosted configuration without displaying secrets:

```bash
npm run auth:configure
npm run auth:verify
npm run auth:flow-verify
npm run security:verify-bundle
```

`auth:verify` checks the Postmark server token, hosted SMTP metadata, callback allow list, confirmation setting, and exact template contents. `auth:flow-verify` creates and removes a disposable non-deliverable test account to verify confirmation enforcement, password sign-in, token issuance, profile provisioning/RLS, profile updates, and sign-out without sending an email.

After `npx expo export --platform web`, `security:verify-bundle` scans the generated output for the configured server-role, database, SMTP, and Postmark values and reports only credential names if a leak is ever detected.

## Email deliverability note

Postmark link tracking should remain disabled for authentication emails because rewritten confirmation links can break Supabase verification. DKIM, SPF, DMARC, sender-domain approval, and production inbox placement are Postmark/domain concerns and should be rechecked before a public launch.
