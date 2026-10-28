# Store account directory

`/api/store/:store_id/accounts` stores each Gmail account (exactly three characters)
as one JSON document in the private Supabase Storage bucket
`store-account-documents`. The server creates this bucket on first use. Object
paths contain the store UUID and SHA-256 of the normalized Gmail address. No SQL
migration is required. Gmail is immutable after creation; duplicate creates are
rejected by Storage. Each account is updated as one object; concurrent edits to
the same account use last-write-wins. Different accounts have independent objects.

Avatar uploads reuse the images bucket under `characters/`, with a new object ID
per upload so canceling an edit cannot overwrite a previously saved avatar.
The frontend resizes images to at most 256 pixels. Replacing or canceling an
uploaded avatar leaves the old image object available; cleanup is not automatic.

The directory describes which character holds which items. It does not change
product quantities. Existing store access conventions are retained.

Validation: `node --import tsx --test scripts/tests/storeAccounts.test.ts`.
