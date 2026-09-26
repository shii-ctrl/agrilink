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
  assert.match(changePassword, /auth\.password\.change/);
  assert.doesNotMatch(changePassword, /return \{[^}]*passwordHash/);
});

test("Management password resets are authenticated and audited", async () => {
  const source = await readFile("src/lib/admin-server-functions.ts", "utf8");
  const resetPassword = source.slice(source.indexOf("export const resetManagedUserPassword"));
  assert.match(resetPassword, /requireRole\("Management"\)/);
  assert.match(resetPassword, /bcrypt\.hash\(data\.password, 12\)/);
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
  assert.match(resetPage, /replace\(\/\\D\/g, ""\)\.slice\(0, 6\)/);
});
