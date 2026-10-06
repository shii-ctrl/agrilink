# AgriLink

AgriLink is a Node.js and MySQL/MariaDB application. Production schema migration and development demonstration data are deliberately separate.

## Local development

1. Install Node.js 20+ and start MySQL/MariaDB (for example, XAMPP MySQL).
2. Copy `.env.example` to `.env.local`, then set `DATABASE_URL` and a long `SESSION_SECRET`.
3. Install dependencies and create the schema:

   ```sh
   npm install
   npm run db:migrate
   npm run dev
   ```

A fresh `npm run db:migrate` database contains tables, roles, and the `Good`, `Semi`, and `Reject` classifications. It intentionally contains no users, products, inventory, orders, payments, receiving records, or other fabricated business activity.

## Development demonstration data

Only for a local, non-production database, set these values in `.env.local`:

```text
DEV_SEED_PASSWORD=use-a-unique-8-character-or-longer-password
ALLOW_DEVELOPMENT_SEED=YES
SEED_DATABASE_URL=mysql://root:@127.0.0.1:3306/agrilink_local
```

Then, after migration, run:

```sh
npm run db:seed:development
```

This explicit command creates the six demonstration accounts and associated products, receiving records, stock, listings, orders, payments, prices, messages, and notifications. It requires `NODE_ENV=development`, an explicit `SEED_DATABASE_URL`, and `ALLOW_DEVELOPMENT_SEED=YES`. The target must be loopback-only and its database name must include `local`, `dev`, or `test`; production and remote database targets are rejected before a connection is opened.

## Existing databases

Do **not** edit the existing `0000`–`0003` migration files. Their checksums are retained for databases that already applied them. The migration runner applies their schema-only portions when installing a fresh database and records their original checksums; `0004_reference_data.sql` supplies roles and classifications.

`_agrilink_migration_modes` records the history of the two legacy migrations: `schema_only` for new installations and `unknown` when an already-applied legacy migration has no reliable historical mode record. Both histories receive all future numbered migrations normally; no existing migration checksum is rewritten. An administrator must resolve `unknown` only after reviewing the backup or historical row counts, then explicitly update that mode to `schema_only` or `full_legacy_data`; AgriLink never guesses or removes data.

Existing databases retain any legacy demo records. Nothing is silently deleted during migration.

If a legacy database has duplicate catalog product names, the `0007` recovery step preserves every product and its connected records. It keeps the earliest name and adds a visible `[legacy <record-id>]` suffix to later duplicates before applying the required unique-name rule. No product, stock, order, or receiving history is deleted.

### Legacy demo-data cleanup (approval required)

The reviewable cleanup script removes only the documented legacy UUIDs. It does not remove roles or classifications. Before running it:

1. Make and verify a database backup.
2. Review the exact deletion list in `scripts/cleanup-legacy-demo-data.mjs`.
3. Obtain explicit approval for the target database.
4. Run the default read-only report first. It lists exact matching demo rows and blocks cleanup if real records reference demo accounts or stock:

   ```text
   LEGACY_DEMO_CLEANUP_DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/TARGET_DATABASE
   LEGACY_DEMO_CLEANUP_TARGET=TARGET_DATABASE
   ```

   Then run `npm run db:cleanup:legacy-demo`.

5. Only after review and explicit approval, set these additional variables and re-run the command:

   ```text
   LEGACY_DEMO_BACKUP_REFERENCE=approved-backup-id-or-location
   LEGACY_DEMO_CLEANUP_APPROVED=YES
   LEGACY_DEMO_CLEANUP_EXECUTE=YES
   ```

This command is intentionally blocked unless all approval safeguards are present. It has not been run by this project setup.

## Isolated migration tests

Tests never derive a database to drop from `DATABASE_URL`. Configure a disposable MySQL/MariaDB admin connection and a unique-name prefix in `.env.local`:

```text
TEST_DATABASE_ADMIN_URL=mysql://USER:PASSWORD@127.0.0.1:3306/mysql
TEST_DATABASE_PREFIX=agrilink_test_
TEST_DATABASE_ENVIRONMENT=disposable
```

`TEST_DATABASE_ADMIN_URL` must be an explicit credential to a loopback-only `mysql` or `information_schema` admin database. `TEST_DATABASE_PREFIX` must include `test`, and `TEST_DATABASE_ENVIRONMENT` must be exactly `disposable`. `npm run db:verify` creates a new random database name per run, verifies it differs from the application database, and removes only the database created by that same run. It fails safely before connecting when this configuration is missing or unsafe.

Run tests as follows:

```sh
npm run test:unit          # no database credentials required
npm run test:integration   # requires the disposable test settings above
npm run test:run           # unit/safety plus required integration verification
```

The verification checks both cases:

- Fresh production migration has schema, roles, and classifications but no demo business data.
- The explicit development seed creates the expected demo users and business records.
- Unsafe seed and test settings fail before a database connection is opened.

## Deployment

Read [DEPLOYMENT.md](DEPLOYMENT.md) before deployment. Use a Node.js host with private MySQL/MariaDB connectivity. Do not use the development seed command, test database settings, or cleanup approval variables in production.

For a fresh production database, set a temporary `INITIAL_MANAGEMENT_SETUP_SECRET`, deploy and migrate, then open `/setup-management` once to create the first Management account. Remove that environment variable immediately afterward. Full instructions are in [DEPLOYMENT.md](DEPLOYMENT.md#first-management-account).

The pre-launch checklist for a custom domain, Resend sender verification, backups, and future Google/Facebook sign-in is in [DEPLOYMENT.md](DEPLOYMENT.md#custom-domain-and-https).
