# Offline synchronization

Offline capture and synchronization are implemented in Phase 5 and hardened in Phase 9. Expo SQLite is already installed and is also used for persistent Supabase sessions.

## Intended durable queue

The device database will persist queue items before a capture flow can be dismissed. Each item records:

- local ID and optional cloud card ID
- operation type and validated payload
- `queued`, `uploading`, `processing`, `synced`, or `failed` status
- creation/update timestamps
- retry count, last error, and next retry time

Original local image URIs must remain retained until upload and cloud metadata are confirmed. A process restart or network loss must not lose a capture.

## Synchronization rules

1. Persist capture metadata and image references locally first.
2. Detect connectivity with Expo Network, while treating connectivity as a hint rather than proof the service is reachable.
3. Create/update the cloud card under the authenticated user.
4. Upload originals to the private owner/card path.
5. Record cloud image metadata and move to extraction/review.
6. Mark the local item synced only after the cloud transaction is recoverable.
7. Retry transient failures with bounded exponential backoff and jitter.

Cloud remains the source of truth. The local card cache is rebuildable after sign-in; the unsynced capture queue is not disposable.

## Conflict posture

Client-generated UUIDs make capture creation idempotent. Updated records will carry timestamps and explicit conflict handling rather than silent last-writer-wins behavior for meaningful edits. Exact source hashes assist repeated-scan detection but do not prevent the user from choosing “Keep both.”
