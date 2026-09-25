# Vercel + Render deployment plan

AgriLink is currently a single TanStack Start application. Its React pages and
secure MySQL actions run in the same Node process. This is the only supported
deployment shape for the current codebase:

```text
Browser -> Render Node service -> MySQL
```

`render.yaml` provisions that service from GitHub. It is the safe first
deployment and preserves login cookies, CSRF protection, server actions, and
MySQL access.

## Why Vercel is not configured yet

The browser pages currently import TanStack `createServerFn` actions. Those
actions make same-origin requests to the TanStack Node server and use server
cookies. Copying only the React files to Vercel would leave these actions on
the wrong host, breaking sign-in, cart, orders, receiving, and management
pages. Giving Vercel the MySQL URL would be insecure and must never be done.

## Safe split target

```text
Browser -> Vercel React frontend -> Render HTTPS API -> managed MySQL
```

Before Vercel can be enabled, the project needs a tested API extraction:

1. Move each server function into an authenticated Render API route.
2. Replace client imports of server functions with an API client using the
   Render URL from `VITE_API_BASE_URL`.
3. Replace same-site cookie sessions with secure cross-site session handling
   (or place both services behind the same custom domain).
4. Add CORS and CSRF rules that allow only the deployed Vercel domain.
5. Test buyer registration, login, cart, orders, receiving, and payment flows
   across the two real origins.

Until all five are implemented and tested, deploy the complete Node service to
Render. This is still a web application and is the safe staging deployment.

## Render staging deployment

1. In Render, select **New > Blueprint** and connect the GitHub repository.
2. Select `render.yaml`.
3. Add `DATABASE_URL` from a managed MySQL provider. Do not use XAMPP or put
   this value in GitHub.
4. Set a one-time `INITIAL_MANAGEMENT_SETUP_SECRET`.
5. Deploy, then run `npm run db:migrate` once with the Render production
   database environment variables.
6. Open `/setup-management`, create the first management account, then remove
   `INITIAL_MANAGEMENT_SETUP_SECRET` and redeploy.

Do not run development seeds against the cloud database.

## Layerbase thesis-demo option

For a no-card thesis demo, Render can host the Node application on its free
plan while Layerbase hosts MariaDB remotely. MariaDB uses the MySQL wire
protocol, so AgriLink's mysql2 and Drizzle MySQL setup work without a database
code rewrite. Create a free MariaDB database at https://layerbase.com, then
set Render's `DATABASE_URL` to the connection URL supplied by Layerbase and
set `DATABASE_SSL=required` because Layerbase uses TLS by default.

Use the database only for the thesis demo until backups, access restrictions,
and a paid production plan have been reviewed.
