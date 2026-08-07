# Codex: Start Here

You are building **Card Nest**.

Read `HANDOFF.md` completely before changing code.

## Your operating rules

- Treat the existing Expo project as the base; do not recreate it unnecessarily.
- The project must target Android and iOS from one Expo/React Native TypeScript codebase.
- Preserve the owner's currently working Expo Go flow where practical.
- The source of truth for Card Nest data is Supabase cloud storage/database.
- Offline capture must be durable and sync later.
- You own Supabase provisioning, schema, migrations, RLS, Storage, indexes, generated types, and Edge Functions where needed.
- Do not tell the owner to manually run SQL if you can do it through the CLI/migrations.
- Do not commit or print secrets.
- Server-only secrets must never enter the Expo bundle.
- User OpenAI/Gemini keys are BYOK and belong in Expo SecureStore only.
- AI model lists are dynamic, not a hard-coded canonical list.
- Use the supplied Card Nest logo and brand color `#0CC0DF`.
- Use the installed UI/UX Pro Max skill as a development/design aid.
- No placeholder production flows.
- Keep the app runnable after each phase.
- Run typecheck/tests before claiming a phase is complete.

## Immediate tasks

1. Audit the repository.
2. Confirm `.env` is ignored.
3. Add safe environment validation.
4. Inspect the supplied logo and configure icon/splash/branding.
5. Create the theme/token system.
6. Link Supabase using the credentials in `.env`.
7. Create migrations for the initial schema, RLS, indexes, and private card-image Storage.
8. Generate database TypeScript types.
9. Implement auth foundation.
10. Document what you changed and what remains.

The complete product specification and definition of done are in `HANDOFF.md`.
