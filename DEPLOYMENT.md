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

1. Create a Resend account. For a public application, verify a domain that you own in Resend.
2. Create a Resend API key and set it as `RESEND_API_KEY` in Render.
3. Set `EMAIL_FROM` to the verified sender in the format `AgriLink <no-reply@your-domain.example>`.
4. Save the values and let Render redeploy, then request a code for an active account whose email you can receive.

Keep the API key private. AgriLink stores only a hash of the code, returns the same request response for unknown emails, limits repeat requests, and revokes existing sign-in sessions after a successful reset.

`AgriLink <onboarding@resend.dev>` is suitable only for Resend's limited test sending. It is not a public sender address and should not be used for a real launch. A Gmail address is an inbox, not a domain that can be verified as the `from` address.

## Custom domain and HTTPS

Before a public launch, connect a domain you own to the Render service:

1. In Render, open the web service settings and add your custom domain.
2. At the company where you purchased the domain, add the DNS record Render asks for.
3. Wait until Render reports that the domain and HTTPS certificate are active, then test `https://YOUR-DOMAIN` in a private browser window.
4. Verify that same domain in Resend and change `EMAIL_FROM` to an address on it, such as `AgriLink <no-reply@your-domain.example>`.

Never use a password, API key, or database URL in DNS records, source code, screenshots, or support messages.

## Backups and recovery

Before every production migration, create an encrypted database backup or export using the Layerbase tool available to the account owner. Record where it is stored and perform a restore test in a separate non-production database. Keep at least one verified backup from before a migration. Do not test a restore by overwriting the live database.

## Google and Facebook sign-in

Google and Facebook sign-in are not shown in the application yet because a secure implementation needs provider-owned credentials, approved redirect URLs, and the final public domain. Do not add placeholder buttons that appear to work but cannot safely sign anyone in.

When the public domain is ready, the project owner must create a Google OAuth application and a Meta/Facebook Login application, add the exact callback URLs supplied by the application, and store the client IDs and secrets only in Render server-side environment variables. The provider setup should also use the live Privacy and Terms pages: `/privacy` and `/terms`. Once those provider details are ready, social sign-in can be added without exposing a client secret to the browser.

## Build and run

```sh
npm ci
npm run db:migrate
npm run build
npm run preview
```

The Node server entry is `.output/server/index.mjs`. Put it behind HTTPS through a reverse proxy such as Nginx, Caddy, Render, Railway, Fly.io, or a VPS. Configure the host to route all application requests to that Node process.

## Vercel deployment

AgriLink can also deploy to Vercel. The Vite configuration automatically builds
Vercel Functions when Vercel performs the build, while Render continues to use
the standard Node server output.

1. In Vercel, choose **Add New → Project** and import `shii-ctrl/agrilink`.
2. Leave the detected **TanStack Start** framework and default build settings in place.
3. Under **Environment Variables**, add the production values for `DATABASE_URL`,
   `DATABASE_SSL` (when required by the database provider), `SESSION_SECRET`,
   `RESEND_API_KEY`, and `EMAIL_FROM`.
4. Do not add `NITRO_HOST` or `NITRO_PORT`; Vercel manages the server runtime.
5. Deploy, then confirm the home page, sign-in, Community, image upload, and a
   password-reset email work on the generated `*.vercel.app` URL.

Vercel functions need a database that accepts connections from Vercel. Confirm
that the Layerbase database is reachable remotely and uses TLS when required.
Keep every secret server-side: never use a `VITE_` prefix for database URLs,
session secrets, or Resend keys.

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
