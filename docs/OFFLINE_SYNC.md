# Offline synchronization

Expo SQLite stores the durable capture queue and also backs persistent Supabase sessions.

## Durable queue

The device database persists each capture before the flow can be dismissed. Every item records:

- local capture ID and client-generated cloud card ID
- durable front image URI and optional back image URI
- `queued`, `uploading`, `processing`, `synced`, or `failed` status
- creation/update timestamps
- retry count, safe user-facing error, and next retry time

The captured files are compressed to JPEG and copied into the app documents directory before the SQLite transaction. Original queue files remain until the cloud image metadata is confirmed. A process restart or network loss cannot silently lose a queued capture.

## Synchronization rules

1. Prepare durable local files and commit the queue row.
2. Treat Expo Network connectivity as a hint, not proof the service is reachable.
3. Upsert the client-generated cloud card under the authenticated user.
4. Upload originals to the private `{user_id}/{card_id}` path.
5. Record image metadata and move through optional extraction to review.
6. Mark the local item synced only after cloud state is recoverable.
7. Retry failures with bounded exponential backoff and jitter, and allow an explicit retry.

Cloud remains the source of truth. The cloud card library rebuilds after sign-in; the unsynced device queue is not disposable. Synced queue history can be cleared without affecting cloud records.

## Conflict and duplicate posture

Client-generated UUIDs make capture creation idempotent. Contact edits use explicit review and update timestamps. Normalized duplicate scoring considers email, phone, name, and company, but never silently discards a card: the user chooses merge or keep separate.
