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
