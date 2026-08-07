# Supabase operations

## Source of truth

`supabase/migrations/20260807093836_initial_cardnest_schema.sql` is the initial hosted schema source of truth. The repository is linked to the configured Supabase project through ignored CLI state under `supabase/.temp/`.

The migrations create:

- `profiles`, `user_preferences`, and server-managed `user_entitlements`
- `cards` and normalized email, phone, website, address, tag, image, and processing-job tables
- composite ownership foreign keys, validation constraints, update triggers, and auth-user provisioning
- full-text, trigram, duplicate-detection, paging, filter, and retry indexes
- the `search_cards` RLS-aware RPC
- RLS policies for every user-owned table
- a private `card-images` bucket with owner-folder policies
- a public, admin-write-only `brand-assets` bucket for the supplied transactional-email logo

## Storage contract

Bucket: `card-images` (private)

Object paths:

```text
{user_id}/{card_id}/front.{ext}
{user_id}/{card_id}/back.{ext}
```

Policies require the first path segment to equal `auth.uid()`. The bucket is limited to 12 MiB per object and approved business-card image MIME types. Signed URLs should be created only when an authenticated screen needs an image.

## Applying migrations

Load trusted credentials from the ignored `.env`, then use the repository-local CLI:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Never run `supabase db reset --linked`; it is destructive to the hosted database.

Docker is optional for hosted operations but required by Supabase CLI commands that create or inspect a local stack or use containerized `pg_dump`.

## Types and verification

```bash
npm run db:types
npm run db:verify
npx supabase db lint --linked --level warning
```

`db:types` writes `src/types/database.types.ts` as UTF-8 without a byte-order mark. `db:verify` checks that anonymous requests cannot retrieve cards and that the card image bucket is private without displaying credentials.

Hosted authentication and Postmark configuration are documented in [Authentication](AUTHENTICATION.md). Use `npm run auth:configure`, `npm run auth:verify`, and `npm run auth:flow-verify`; none of these commands displays credentials.

## Security rules

- Never use the service-role key in `app/` or `src/`.
- Do not weaken RLS to compensate for client bugs.
- Add every schema change as a forward migration and regenerate types afterward.
- Use owner-prefixed Storage paths; never make original business-card images public.
- Entitlements are server-managed. Authenticated clients receive `SELECT` only.
