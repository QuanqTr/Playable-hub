# Database checks

Run these against a disposable local Supabase stack or a dedicated test project.
The SQL tests insert Auth/Storage metadata and therefore need the local database
administrator connection used by the Supabase CLI; the application never needs
an administrator/service key.

```sh
supabase start
supabase db reset
supabase test db
```

`database.test.sql` uses pgTAP and a rollback transaction. It checks anonymous
access, member collaboration, membership provisioning, audit spoofing, source/code
immutability, required sources, HTTP URL validation, metadata validation, network
atomicity, private bucket limits, Storage path/overwrite/cleanup policies,
foreign-key protection of referenced objects against concurrent save/cleanup,
combined filters, deterministic pagination, and archive/restore behavior.
The only sequence values consumed by rolled-back tests are harmless gaps.

For actual independent HTTP requests competing for codes, supply an **invited
test member** and public Supabase credentials in an uncommitted `.env.local`:

```dotenv
SUPABASE_TEST_EMAIL=invited-test-user@example.com
SUPABASE_TEST_PASSWORD=your-test-user-password
```

```sh
node --env-file=.env.local supabase/tests/concurrency.mjs
```

This test sends 24 parallel creates, verifies unique IDs/codes and two separate
12-row pages, then archives its fixture project. It intentionally leaves archived
records for inspection; use a dedicated test project. Missing configuration exits
before creating anything.

The SQL tests use Storage **metadata fixtures**, not real file blobs. Verify real
upload (including MIME/size rejection), signed download, expiration, sign-in,
invite/recovery callback and browser redirects against the configured Supabase
service using the main README checklist. A local SQL pass cannot establish these
external-service behaviors.

Configuration references: [Supabase CLI configuration](https://supabase.com/docs/guides/local-development/cli/config),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control),
[Storage schema](https://supabase.com/docs/guides/storage/schema/design).
