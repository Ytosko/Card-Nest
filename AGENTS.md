# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# GitHub Release Artifact Naming Policy

For EVERY Card Nest GitHub release, NEVER upload generic build filenames (`app-release.apk`, `apk-release.apk`, `app-release.aab`, `bundle-release.aab`).

Before publication, copy Gradle build outputs to temporary versioned root files:
- `Card-Nest-<VERSION>-android.apk`
- `Card-Nest-<VERSION>-android.aab`

Upload ONLY the versioned assets (and `cardnest-release.json`). Verify asset names via `gh release view <TAG> --json assets` after upload. If generic names appear, delete them immediately with `gh release delete-asset` and re-upload the versioned copies. Remove root-level temporary copies after publication while preserving canonical Gradle build outputs.

