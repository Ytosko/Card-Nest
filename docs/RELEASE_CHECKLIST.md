# Release checklist

## Automated

- [ ] `npm run check` passes.
- [ ] `npm run db:verify` passes against the intended project.
- [ ] `npx supabase db lint --linked --level warning` reports no schema errors.
- [ ] `npx expo-doctor` passes.
- [ ] Production export/build completes for Android and iOS.
- [ ] No `.env`, service-role key, access token, database password, SMTP password, Postmark token, or user AI key is tracked.
- [ ] Generated database types match the deployed migration.

## Product and device

- [ ] Sign up, confirmation, sign in, reset password, session restore, and sign out work on real devices.
- [ ] Camera captures readable front/back images and handles permission denial.
- [ ] A capture survives force-close and loss of connectivity.
- [ ] Upload automatically resumes and originals restore on another device.
- [ ] OpenAI and Gemini keys remain in SecureStore; model lists refresh dynamically.
- [ ] Extraction is validated and every field is editable before save.
- [ ] Exact and likely duplicates offer merge, keep both, and cancel.
- [ ] Search remains responsive with a large paginated library.
- [ ] One-card and explicit bulk Contacts exports show progress and results.
- [ ] Delete card and delete account remove the correct cloud data and private images.

## UI and accessibility

- [ ] Light and dark themes meet contrast requirements.
- [ ] Touch targets are at least 44 pt on iOS and 48 dp on Android.
- [ ] Dynamic Type does not hide actions or data.
- [ ] Screen-reader labels, order, roles, states, and error announcements are correct.
- [ ] Reduced Motion is respected.
- [ ] Small phone, large phone, tablet, portrait, and landscape layouts are verified.
- [ ] Splash is checked in a release build; Expo Go does not fully reproduce SDK 54 splash behavior.

## Privacy and operations

- [ ] Card images bucket remains private and Storage RLS is verified.
- [ ] Cross-user database and Storage tests pass.
- [ ] Privacy, support, and terms URLs are production values.
- [ ] Postmark SMTP and branded auth templates are production-verified.
- [ ] No analytics or telemetry is added without an explicit privacy decision.
- [ ] Store metadata, icon masks, screenshots, version numbers, and signing credentials are complete.
