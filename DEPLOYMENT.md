# AgriLink deployment

AgriLink requires a **Node.js 20+ server** that can make a private TCP connection to MySQL or MariaDB. Do not deploy this build to Cloudflare Workers, static hosting, or a serverless environment without a compatible MySQL connection strategy.

## Required environment variables

```text
NODE_ENV=production
DATABASE_URL=mysql://USER:PASSWORD@DATABASE_HOST:3306/agrilink
SESSION_SECRET=use-a-long-random-secret
INITIAL_MANAGEMENT_SETUP_SECRET=one-long-random-one-time-secret
NITRO_HOST=0.0.0.0
NITRO_PORT=3000
```

`DATABASE_URL` and `SESSION_SECRET` are server-only secrets. Never prefix them with `VITE_`, commit them, or enter them in client-side configuration.

## Build and run

```sh
npm ci
npm run db:migrate
npm run build
npm run preview
```

The Node server entry is `.output/server/index.mjs`. Put it behind HTTPS through a reverse proxy such as Nginx, Caddy, Render, Railway, Fly.io, or a VPS. Configure the host to route all application requests to that Node process.

## Database migration procedure

1. Back up the production database.
2. Set `DATABASE_URL` to the target database.
3. Run `npm run db:migrate` once during a maintenance window.
4. Confirm `_agrilink_migrations` contains every migration and check application health.

## First Management account

1. Generate a unique secret of at least 24 characters and set it as `INITIAL_MANAGEMENT_SETUP_SECRET` in the hosting provider's **server-side** environment settings.
2. After migrations finish, visit `https://YOUR-DOMAIN/setup-management` over HTTPS. Enter the secret, then create the first Management account.
3. Sign in at `/login` to verify the account.
4. Remove `INITIAL_MANAGEMENT_SETUP_SECRET` from the hosting provider immediately and redeploy or restart the service.

The setup page is not linked from the public site and is marked not to be indexed. The server compares the secret safely, permits setup only while no Management account exists, and serializes simultaneous setup attempts. It never sends the configured secret or password hash to the browser. Do not reuse this secret, share it, or leave it configured after setup.

Fresh production migration creates no demonstration accounts or business records. Do not run `npm run db:seed:development` in production.

`_agrilink_migration_modes` makes fresh schema-only history distinct from an existing legacy full-data history. Both continue to receive future migrations in the normal numbered sequence. Do not alter checksums in `0000`–`0003`.

To test migrations locally without touching production, configure a loopback-only `TEST_DATABASE_ADMIN_URL`, a `TEST_DATABASE_PREFIX` containing `test`, and `TEST_DATABASE_ENVIRONMENT=disposable` as described in the README. Then run `npm run db:verify`. It creates a uniquely named disposable database and removes only that database after the test completes. `npm run test:run` includes this integration verification and fails when it is not configured or does not pass.

Legacy demo-data removal is never part of migration. It requires a verified backup and explicit approval variables; see the README before considering `npm run db:cleanup:legacy-demo`.
