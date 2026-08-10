# Android native updates

Card Nest checks the official [`Ytosko/Card-Nest`](https://github.com/Ytosko/Card-Nest) GitHub releases feed once after application bootstrap. Native APK releases and Expo over-the-air updates are deliberately separate: an APK can change native code and Android permissions, while an OTA update must remain compatible with the installed runtime.

## Release selection

- Stable installations accept stable releases only.
- Beta installations accept beta and stable releases.
- Alpha installations accept alpha, beta, and stable releases.
- Draft releases are ignored. The APK must be named exactly `Card-Nest-<version>-android.apk`, use an HTTPS download URL under the official repository, and have a credible size.
- Semantic version is the primary comparison. `versionCode` from release notes is used to distinguish builds with the same semantic version.

## Download and install lifecycle

The UI uses explicit `checking`, `updateAvailable`, `downloading`, `downloaded`, `installPermissionRequired`, `launchingInstaller`, and `error` states. A single active download is shared, progress is streamed to the UI, and a verified completed APK is reused instead of being downloaded again.

Completed-download metadata is stored in Android secure storage. It contains only the release version, asset name, file URI, size, SHA-256, and download time. The APK remains in Card Nest's private document directory. Partial files and mismatched files are rejected. The PIN and authentication credentials are never part of update metadata.

Installer handoff uses a temporary Android `content://` URI, the APK MIME type, and read permission. On Android 8 or later, Card Nest checks whether this app is allowed to request package installs and opens the system's per-app unknown-sources screen when approval is required. Returning to Card Nest reuses the already verified APK and retries the installer; it does not download the file again.

## Verification scope

Automated tests cover release/channel selection, official asset validation, streamed download persistence and reuse, partial-file rejection, installer MIME/URI flags, and unknown-sources recovery. Android Emulator testing validates the Kotlin bridge and installer intent behavior. OEM-specific package installers, biometric hardware, and manufacturer Contacts account behavior still require later physical-device verification.
