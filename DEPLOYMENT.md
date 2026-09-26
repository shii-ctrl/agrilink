# AgriLink deployment

AgriLink requires a **Node.js 20+ server** that can make a private TCP connection to MySQL or MariaDB. Do not deploy this build to Cloudflare Workers, static hosting, or a serverless environment without a compatible MySQL connection strategy.

## Required environment variables

```text
NODE_ENV=production
DATABASE_URL=mysql://USER:PASSWORD@DATABASE_HOST:3306/agrilink
# Set this when the selected managed MySQL provider requires TLS.
DATABASE_SSL=required
SESSION_SECRET=use-a-long-random-secret
INITIAL_MANAGEMENT_SETUP_SECRET=one-long-random-one-time-secret
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=AgriLink <no-reply@your-verified-domain.example>
NITRO_HOST=0.0.0.0
NITRO_PORT=3000
```

`DATABASE_URL` and `SESSION_SECRET` are server-only secrets. Never prefix them with `VITE_`, commit them, or enter them in client-side configuration.

## Email password recovery

AgriLink's **Forgot password?** page sends a six-digit, single-use code that expires in 10 minutes. It uses the [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email), so add these server-side values in Render before testing it:

1. Create a Resend account and verify a sender domain or sender address.
2. Create a Resend API key and set it as `RESEND_API_KEY` in Render.
3. Set `EMAIL_FROM` to the verified sender in the format `AgriLink <no-reply@your-domain.example>`.
4. Save the values and let Render redeploy, then request a code for an active account whose email you can receive.

Keep the API key private. AgriLink stores only a hash of the code, returns the same request response for unknown emails, limits repeat requests, and revokes existing sign-in sessions after a successful reset.

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
