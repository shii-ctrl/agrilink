# AgriLink workflow checks

`npm run check` runs type checking, lint, a production build, unit tests,
migration verification, production HTTP tests, and the production startup smoke test.

## Real multi-role workflows

`e2e/all-role-workflows.test.mjs` starts the built production server on loopback
port 4187. It uses actual HTTP requests, session cookies, validation, role checks,
database transactions, notifications, and audit records. It does not mock the
application's authentication or business handlers.

Coverage includes:

- All six roles: login, workspace data, permission boundaries, role page rendering,
  session revocation, and logout.
- Management: internal staff creation, password reset, Farmer application approval,
  account activation, reports, and audit history.
- Marketer: catalog, classification, fractional kilogram receiving and corrections,
  whole-unit tray restrictions, daily prices, confirmation, fulfillment, and cancellation.
- Buyer: registration, persistent carts, price/availability review, account isolation, pending orders without stock
  holds, pickup, delivery, feedback, and delivery disputes.
- Rider: assignment isolation, Buyer/Rider messaging during delivery, OTP checks,
  delivery proof, COD submission, and post-delivery messaging restrictions.
- Accounting: payment badges, cash payment, duplicate payment rejection, COD
  verification/closing, refunds, Farmer payouts, and locked daily cash closing.
- Walk-ins: no buyer account, confirmation-only stock allocation, retries,
  cancellation, zero-stock visibility, original Farmer attribution, and earnings.
- Farmer planting costs: dated expenses and corrections, account isolation, unique
  delivery links, online/walk-in sales attribution, IPON separation, and preserved
  payouts when costs or delivery links change.
- Farmer earnings: unsold deliveries, reserved versus sold products, per-delivery
  sales and deductions, pending/available/paid cash, payout receipt references,
  and isolation from other Farmers' deliveries and earnings.
- Community: questions, replies, reactions, Management resolution, closed comments,
  allowed private conversations, and notification ownership.
- Dashboards and reports reload both before and after saved transactions.

## Disposable database setup

These tests **never use the application's database as a mutation test target**.
Provide an explicit local admin connection; each suite creates a randomly named
test database and drops only its own database in cleanup. The HTTP suite creates
its database as UTF-8 to support Filipino text and peso amounts.

Example PowerShell configuration, using a separate local MySQL instance:

```powershell
$env:ALL_ROLES_TEST_DATABASE_ADMIN_URL = 'mysql://USER:PASSWORD@127.0.0.1:3317/mysql'
$env:STOCK_TEST_DATABASE_ADMIN_URL = $env:ALL_ROLES_TEST_DATABASE_ADMIN_URL
$env:FARMER_TEST_DATABASE_ADMIN_URL = $env:ALL_ROLES_TEST_DATABASE_ADMIN_URL
$env:TEST_DATABASE_ADMIN_URL = $env:ALL_ROLES_TEST_DATABASE_ADMIN_URL
$env:TEST_DATABASE_PREFIX = 'agrilink_check_test_'
$env:TEST_DATABASE_ENVIRONMENT = 'disposable'

npm run check
node --test test/confirmation-stock.test.mjs test/farmer-registration.test.mjs
```

The stock suite additionally verifies competing confirmations, multi-item rollback,
legacy migration recovery, and settlement splits across original Farmer batches.
The Farmer suite additionally checks existing accounts and rejected applications.
The three opt-in workflow suites report **skipped** when their explicit test
database variables are missing; do not count a skipped suite as a passing workflow.

## Boundaries

These are production-server HTTP and database tests, including server-rendered page
checks. They are not browser click, mobile layout, accessibility, or full visual tests.
They do not mutate live Render data or invoke external Gemini, email, SMS, or image
storage providers. Those integrations and deployment-specific settings need separate
verification when used.
