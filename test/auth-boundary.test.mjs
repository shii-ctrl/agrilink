import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("buyer registration response is an explicit safe DTO", async () => {
  const source = await readFile("src/lib/auth-functions.ts", "utf8");
  const registration = source.slice(source.indexOf("export const registerBuyer"));
  assert.match(registration, /return \{\s*id: user\.id,/);
  assert.doesNotMatch(registration, /return \{ \.\.\.user/);
});

test("initial Management setup is guarded by a server-side one-time secret", async () => {
  const source = await readFile("src/lib/admin-server-functions.ts", "utf8");
  const setup = source.slice(source.indexOf("export const createInitialManagementAccount"));
  assert.match(setup, /INITIAL_MANAGEMENT_SETUP_SECRET/);
  assert.match(setup, /timingSafeEqual/);
  assert.match(setup, /FOR UPDATE/);
  assert.match(setup, /A Management account already exists/);
  assert.doesNotMatch(setup, /return \{[^}]*passwordHash/);
});

test("password changes require authentication and hash the new password", async () => {
  const source = await readFile("src/lib/auth-functions.ts", "utf8");
  const changePassword = source.slice(source.indexOf("export const changeCurrentPassword"));
  assert.match(changePassword, /requireUser/);
  assert.match(changePassword, /bcrypt\.compare\(data\.currentPassword/);
  assert.match(changePassword, /bcrypt\.hash\(data\.newPassword, 12\)/);
  assert.match(changePassword, /update\(authSessions\)\s*\.set\(\{ revokedAt: now \}\)/);
  assert.match(changePassword, /createSession\(user\.id\)/);
  assert.match(changePassword, /auth\.password\.change/);
  assert.doesNotMatch(changePassword, /return \{[^}]*passwordHash/);
});

test("Management password resets are authenticated and audited", async () => {
  const source = await readFile("src/lib/admin-server-functions.ts", "utf8");
  const resetPassword = source.slice(source.indexOf("export const resetManagedUserPassword"));
  assert.match(resetPassword, /requireRole\("Management"\)/);
  assert.match(resetPassword, /bcrypt\.hash\(data\.password, 12\)/);
  assert.match(resetPassword, /update\(authSessions\)\s*\.set\(\{ revokedAt: now \}\)/);
  assert.match(resetPassword, /user\.password\.reset/);
  assert.doesNotMatch(resetPassword, /return \{[^}]*passwordHash/);
});

test("all account password flows accept eight-character passwords", async () => {
  const [authSource, adminSource, registrationPage, setupPage] = await Promise.all([
    readFile("src/lib/auth-functions.ts", "utf8"),
    readFile("src/lib/admin-server-functions.ts", "utf8"),
    readFile("src/routes/register.tsx", "utf8"),
    readFile("src/routes/setup-management.tsx", "utf8"),
  ]);

  assert.match(authSource, /\.min\(8, "Use at least 8 characters\."\)/);
  assert.match(adminSource, /\.min\(8, "Use at least 8 characters\."\)/);
  assert.doesNotMatch(
    authSource,
    /Include an uppercase letter|Include a lowercase letter|Include a number/,
  );
  assert.doesNotMatch(
    adminSource,
    /Include an uppercase letter|Include a lowercase letter|Include a number/,
  );
  assert.match(registrationPage, /minLength=\{8\}/);
  assert.match(setupPage, /minLength=\{8\}/);
});

test("email password reset uses a hashed, expiring one-time code", async () => {
  const [source, resetPage] = await Promise.all([
    readFile("src/lib/auth-functions.ts", "utf8"),
    readFile("src/routes/forgot-password.tsx", "utf8"),
  ]);
  const requestReset = source.slice(
    source.indexOf("export const requestPasswordResetCode"),
    source.indexOf("export const completePasswordReset"),
  );
  const completeReset = source.slice(source.indexOf("export const completePasswordReset"));

  assert.match(requestReset, /crypto\.randomInt\(0, 1_000_000\)/);
  assert.match(requestReset, /hashPasswordResetCode\(code\)/);
  assert.match(requestReset, /expiresAt/);
  assert.match(requestReset, /sendPasswordResetCode/);
  assert.doesNotMatch(requestReset, /return \{[^}]*code/);
  assert.match(completeReset, /isNull\(passwordResetTokens\.usedAt\)/);
  assert.match(completeReset, /\.update\(passwordResetTokens\)\s*\.set\(\{ usedAt: now \}\)/);
  assert.match(completeReset, /\.update\(authSessions\)\s*\.set\(\{ revokedAt: now \}\)/);
  assert.match(completeReset, /auth\.password\.reset\.email_otp/);
  assert.match(resetPage, /value=\{code\}/);
  assert.match(resetPage, /type="text"/);
  assert.match(resetPage, /autoComplete="one-time-code"/);
  assert.match(resetPage, /replace\(\/\\D\/g, ""\)\.slice\(0, 6\)/);
});

test("authentication abuse controls persist beyond a single server process", async () => {
  const [authServer, authFunctions, admin, schema, migration] = await Promise.all([
    readFile("src/lib/auth-server.ts", "utf8"),
    readFile("src/lib/auth-functions.ts", "utf8"),
    readFile("src/lib/admin-server-functions.ts", "utf8"),
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0008_security_rate_limits.sql", "utf8"),
  ]);

  assert.match(authServer, /export async function consumeRateLimit/);
  assert.match(authServer, /FOR UPDATE/);
  assert.match(
    authServer,
    /windowStartedAt, new Date\(now\.getTime\(\) - 24 \* 60 \* 60 \* 1000\)/,
  );
  assert.doesNotMatch(authServer, /const loginAttempts = new Map/);
  assert.match(authFunctions, /password-reset-request-email/);
  assert.match(authFunctions, /password-reset-verify/);
  assert.match(authFunctions, /buyer-registration/);
  assert.match(admin, /initial-management-setup/);
  assert.match(schema, /export const securityRateLimits/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS security_rate_limits/);
});

test("production responses set browser security headers", async () => {
  const server = await readFile("src/server.ts", "utf8");

  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /Strict-Transport-Security/);
  assert.match(server, /X-Frame-Options/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /Referrer-Policy/);
});

test("profile photos use optional HTTPS links and Management controls are audited", async () => {
  const [authFunctions, adminFunctions, schema, migration] = await Promise.all([
    readFile("src/lib/auth-functions.ts", "utf8"),
    readFile("src/lib/admin-server-functions.ts", "utf8"),
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0009_user_profile_photos.sql", "utf8"),
  ]);

  assert.match(authFunctions, /const httpsImageUrl/);
  assert.match(authFunctions, /protocol === "https:"/);
  assert.match(authFunctions, /avatarUrl: httpsImageUrl\.nullable\(\)/);
  assert.match(schema, /avatarUrl: varchar\("avatar_url"/);
  assert.match(migration, /ADD COLUMN avatar_url/);
  assert.match(adminFunctions, /export const setManagedUserActive/);
  assert.match(adminFunctions, /Keep at least one active Management account/);
  assert.match(adminFunctions, /user\.deactivate/);
  assert.match(adminFunctions, /export const getManagementAuditLogs/);
});

test("marketplace cart controls prevent duplicate additions beyond available stock", async () => {
  const source = await readFile("src/routes/marketplace.$productId.tsx", "utf8");
  assert.match(source, /const \[isAdding, setIsAdding\] = useState\(false\)/);
  assert.match(source, /getBuyerCart\(\)/);
  assert.match(source, /remainingCartableQuantity/);
  assert.match(source, /All \$\{cartQuantityKg\} kg available is already in your cart/);
});

test("role workflows keep catalog, cart, and Farmer stock states consistent", async () => {
  const [marketplace, receiving, notifications] = await Promise.all([
    readFile("src/lib/marketplace-server-functions.ts", "utf8"),
    readFile("src/lib/receiving-server-functions.ts", "utf8"),
    readFile("src/lib/notification-server.ts", "utf8"),
  ]);

  assert.match(marketplace, /cropType: z\.enum\(cropTypes\)/);
  assert.match(marketplace, /A catalog product with that name already exists/);
  assert.match(marketplace, /inArray\(cartItems\.listingId, listingIds\)/);
  assert.match(receiving, /"Listed — partly reserved"/);
  assert.match(receiving, /"Sold out"/);
  assert.match(notifications, /eq\(users\.active, true\)/);
});

test("reordered carts, community access, and crop guidance protect role boundaries", async () => {
  const [marketplace, community, guidance, admin, migration] = await Promise.all([
    readFile("src/lib/marketplace-server-functions.ts", "utf8"),
    readFile("src/lib/community-server-functions.ts", "utf8"),
    readFile("src/lib/guidance-server-functions.ts", "utf8"),
    readFile("src/lib/admin-server-functions.ts", "utf8"),
    readFile("drizzle/0007_catalog_and_guidance_integrity.sql", "utf8"),
  ]);

  assert.match(marketplace, /export const rebuildBuyerCartFromOrder/);
  assert.match(marketplace, /await db\.transaction/);
  assert.match(marketplace, /One or more products from this order are no longer available/);
  assert.match(
    community,
    /requireAnyRole\(\["Management", "Marketer", "Farmer", "Farm Consultant"\]\)/,
  );
  assert.match(guidance, /farmerConsultantAssignments/);
  assert.match(guidance, /not assigned to your guidance workspace/);
  assert.match(admin, /export const setGuidanceAssignment/);
  assert.match(migration, /UNIQUE KEY products_name_unique/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS farmer_consultant_assignments/);
});

test("Management monitoring uses saved data instead of browser demo records", async () => {
  const [marketplace, decisionSupport, products, reports, layout] = await Promise.all([
    readFile("src/lib/marketplace-server-functions.ts", "utf8"),
    readFile("src/routes/management.decision-support.tsx", "utf8"),
    readFile("src/routes/management.products.tsx", "utf8"),
    readFile("src/routes/management.reports.tsx", "utf8"),
    readFile("src/components/management-layout.tsx", "utf8"),
  ]);

  assert.match(marketplace, /export const getManagementDecisionSupport/);
  assert.match(marketplace, /export const getManagementProductWorkspace/);
  assert.match(decisionSupport, /getManagementDecisionSupport/);
  assert.doesNotMatch(decisionSupport, /getDemo|subscribeDemo|demo-/);
  assert.match(products, /getManagementProductWorkspace/);
  assert.match(reports, /highestAvailability/);
  assert.match(layout, /getCurrentSessionUser/);
  assert.doesNotMatch(layout, /Maria Santos/);
});
