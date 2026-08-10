# Card Nest web application

The production Next.js application in `web/` serves both the public Card Nest website and the authenticated product from one Coolify container and one domain: `https://cardnest.ytosko.dev`.

## Routes

- `/` — public marketing and Google-verification-compliant homepage
- `/auth`, `/auth/forgot`, `/auth/reset-password`, `/auth/callback` — first-party browser authentication
- `/app` — private overview and recent contacts
- `/app/contacts`, `/app/contacts/[id]` — searchable library, add/edit/detail, favorites, tags, images, multi-select, and bulk actions
- `/app/search` — normalized and original-text search
- `/app/scan` — upload, drag/drop, paste, and `MediaDevices` camera capture for front/back cards
- `/app/settings/profile` — shared profile foundation
- `/app/settings/ai` — encrypted BYOK provider credentials and dynamic model selection
- `/app/settings/security` — browser PIN and temporary unlock policy
- `/api/app/export` — selected/all vCard and CSV exports

All private reads and writes use the same hosted Supabase users, schema, RLS policies, and private Storage buckets as the mobile application. No service-role key is present in the Next.js runtime.

## Web authentication boundary

Google web OAuth returns to `https://cardnest.ytosko.dev/auth/callback?next=/app`. That callback is a Next.js Route Handler so Supabase can exchange the PKCE code and write the browser session cookies before redirecting. The allow-listed `next` value accepts only `/app` routes and never emits a mobile deep link. Android/mobile Google OAuth remains isolated at `/gauth/callback`, which retains the existing `cardnest://` relay.

Next.js `proxy.ts` refreshes expiring Supabase sessions before private Server Components run, forwarding rotated cookies to the request and browser response with private/no-store cache headers. The private layout then waits for the server-side `getUser()` check. A genuinely missing or invalid session returns to login; a transient Auth/network failure produces a retry state without destroying the cookie session. Once authenticated, the browser PIN gate displays its own loading state while reading local storage, then shows setup for a new browser or unlock for a returning browser.

## Browser app lock

After a successful account login, each browser must create its own six-digit PIN. The plaintext PIN is never persisted or synchronized. Card Nest generates a random 128-bit salt and derives a verifier with PBKDF2-SHA-256 at 210,000 iterations through Web Crypto. Local storage contains only the versioned salt, verifier, timeout, and retry state under a per-user key.

Incorrect attempts receive increasing delays. After verification, the browser writes a separate temporary unlock proof to `sessionStorage`; it contains only the authenticated user ID, PIN-config generation ID, unlock time, and expiration time. The default window is six hours, with browser restart, one hour, six hours, and twelve hours available in Security settings. Refreshes and normal `/app/*` navigation reuse that proof, and `BroadcastChannel` synchronizes unlock and explicit lock events between same-origin Card Nest tabs. The proof is rejected after expiration, an account switch, a PIN change/reset, explicit lock, or sign-out.

Using `sessionStorage` is an intentional security tradeoff: the browser remains unlocked across refreshes and same-session tabs but requires the PIN again after the full browser session is closed. The PIN and verifier are never placed in the temporary record. Expiration is enforced on a safe route or visibility transition so an in-progress scan or edit remains mounted instead of losing draft state. Forgot-PIN reset requires fresh password or Google OAuth re-authentication and resets only the current browser. Google recovery uses a five-minute HttpOnly nonce that is consumed after the successful callback. Mobile PINs and browser PINs are intentionally independent. Biometrics and passkeys are not shown on the web.

## AI credential boundary

The browser sends a provider key only to a same-origin authenticated API route. The `ai-credentials` Edge Function tests it and stores AES-256-GCM ciphertext per user. Status endpoints return only connected state and a suffix. Dynamic model discovery and extraction decrypt the key only inside Edge Function memory; no decrypted key is returned to Next.js or browser JavaScript.

The `ai-extract` function accepts up to two prepared images, applies the shared multilingual normalized schema, and returns reviewable contact data. Original front/back images are uploaded to the owner-prefixed private `card-images` bucket only after the user reviews and saves. Matching primary email or phone values trigger duplicate confirmation.

## PWA and offline behavior

`/app` has a branded manifest, icon, standalone display mode, theme colors, and service-worker registration. The service worker caches only public shell assets and explicitly bypasses private `/app` and `/api` requests. Card Nest does not claim offline private-data support on web.

## Verification

Run from the repository root:

```bash
npm run web:check
docker compose build
docker compose up -d
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(async r => { console.log(await r.text()); if (!r.ok) process.exit(1) })"
docker compose down
```

Use a real account in browser QA to verify account login, first browser PIN setup, unlock/recovery, shared contact edits, scan review/save, exports, session restoration, and every responsive breakpoint.
