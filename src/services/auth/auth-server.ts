import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { deleteCookie, getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";

import { db } from "@/db/client.server";
import { auditLogs, authSessions, roles, securityRateLimits, userRoles, users } from "@/db/schema";

export const sessionCookieName = "agrilink_session";
const sessionLifetimeSeconds = 60 * 60 * 24;
const loginRateLimit = { maxAttempts: 5, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 };
const loginSourceRateLimit = { maxAttempts: 20, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 };

export type RateLimitPolicy = {
  maxAttempts: number;
  windowMs: number;
  lockMs: number;
};

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  contact: string | null;
  avatarUrl: string | null;
  avatarVisibility: "everyone" | "hidden";
  roles: string[];
};

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: sessionLifetimeSeconds,
  };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getAttemptKey(identifier: string) {
  return identifier.trim().toLowerCase();
}

export function getRequestRateLimitKey() {
  return getRequestIP() ?? "unknown";
}

async function hashRateLimitKey(scope: string, key: string) {
  return hashToken(`${scope}:${key}`);
}

export async function consumeRateLimit(
  scope: string,
  key: string,
  policy: RateLimitPolicy,
): Promise<boolean> {
  const keyHash = await hashRateLimitKey(scope, key);
  const now = new Date();
  const newWindowStart = new Date(now.getTime() - policy.windowMs);

  return db.transaction(async (tx) => {
    // The table only retains active throttle windows; this prevents stale public-input keys
    // from becoming permanent database records.
    await tx
      .delete(securityRateLimits)
      .where(lt(securityRateLimits.windowStartedAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)));
    // Serialize updates for this key so concurrent requests cannot bypass the limit.
    await tx.execute(
      sql`SELECT scope FROM security_rate_limits WHERE scope = ${scope} AND key_hash = ${keyHash} FOR UPDATE`,
    );
    const [record] = await tx
      .select()
      .from(securityRateLimits)
      .where(and(eq(securityRateLimits.scope, scope), eq(securityRateLimits.keyHash, keyHash)));

    if (record?.lockedUntil && record.lockedUntil > now) return false;

    const startsNewWindow = !record || record.windowStartedAt <= newWindowStart;
    const attempts = startsNewWindow ? 1 : record.attempts + 1;
    if (!startsNewWindow && record.attempts >= policy.maxAttempts) {
      await tx
        .update(securityRateLimits)
        .set({ lockedUntil: new Date(now.getTime() + policy.lockMs) })
        .where(and(eq(securityRateLimits.scope, scope), eq(securityRateLimits.keyHash, keyHash)));
      return false;
    }

    const lockedUntil =
      attempts >= policy.maxAttempts ? new Date(now.getTime() + policy.lockMs) : null;
    if (record) {
      await tx
        .update(securityRateLimits)
        .set({
          attempts,
          windowStartedAt: startsNewWindow ? now : record.windowStartedAt,
          lockedUntil,
        })
        .where(and(eq(securityRateLimits.scope, scope), eq(securityRateLimits.keyHash, keyHash)));
    } else {
      await tx.insert(securityRateLimits).values({
        scope,
        keyHash,
        attempts,
        windowStartedAt: now,
        lockedUntil,
      });
    }
    return true;
  });
}

export async function isRateLimitAvailable(scope: string, key: string) {
  const keyHash = await hashRateLimitKey(scope, key);
  const [record] = await db
    .select({ lockedUntil: securityRateLimits.lockedUntil })
    .from(securityRateLimits)
    .where(and(eq(securityRateLimits.scope, scope), eq(securityRateLimits.keyHash, keyHash)));
  return !record?.lockedUntil || record.lockedUntil <= new Date();
}

export async function clearRateLimit(scope: string, key: string) {
  const keyHash = await hashRateLimitKey(scope, key);
  await db
    .delete(securityRateLimits)
    .where(and(eq(securityRateLimits.scope, scope), eq(securityRateLimits.keyHash, keyHash)));
}

export async function assertLoginAllowed(identifier: string, source: string) {
  const [accountAvailable, sourceAvailable] = await Promise.all([
    isRateLimitAvailable("login", getAttemptKey(identifier)),
    isRateLimitAvailable("login-source", source),
  ]);
  if (!accountAvailable || !sourceAvailable) {
    throw new Error("Too many sign-in attempts. Please wait 15 minutes and try again.");
  }
}

export async function registerFailedLogin(identifier: string, source: string) {
  await Promise.all([
    consumeRateLimit("login", getAttemptKey(identifier), loginRateLimit),
    consumeRateLimit("login-source", source, loginSourceRateLimit),
  ]);
}

export async function clearFailedLogins(identifier: string) {
  await clearRateLimit("login", getAttemptKey(identifier));
}

async function getRolesForUser(userId: string) {
  const rows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  return rows.map((row) => row.name);
}

async function asAuthUser(user: typeof users.$inferSelect): Promise<AuthUser> {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    contact: user.contact,
    avatarUrl: user.avatarUrl,
    // Older middle-scope choices were retired. Treat them as Everyone until
    // the normalization migration updates the saved value.
    avatarVisibility: user.avatarVisibility === "hidden" ? "hidden" : "everyone",
    roles: await getRolesForUser(user.id),
  };
}

export async function createSession(userId: string) {
  const rawToken = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  await db.insert(authSessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await hashToken(rawToken),
    expiresAt: new Date(now.getTime() + sessionLifetimeSeconds * 1000),
  });
  setCookie(sessionCookieName, rawToken, cookieOptions());
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const rawToken = getCookie(sessionCookieName);
  if (!rawToken) return null;
  const [session] = await db
    .select({ sessionId: authSessions.id, user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, await hashToken(rawToken)),
        gt(authSessions.expiresAt, new Date()),
        isNull(authSessions.revokedAt),
        eq(users.active, true),
      ),
    );
  return session ? asAuthUser(session.user) : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required. Please sign in again.");
  return user;
}

export async function requireRole(role: string) {
  const user = await requireUser();
  if (!user.roles.includes(role)) throw new Error("You do not have permission for this action.");
  return user;
}

export async function requireAnyRole(roleNames: string[]) {
  const user = await requireUser();
  if (!user.roles.some((role) => roleNames.includes(role))) {
    throw new Error("You do not have permission for this action.");
  }
  return user;
}

export async function revokeCurrentSession() {
  const rawToken = getCookie(sessionCookieName);
  if (rawToken) {
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(authSessions.tokenHash, await hashToken(rawToken)), isNull(authSessions.revokedAt)),
      );
  }
  deleteCookie(sessionCookieName, { path: "/" });
}

type AuditLogExecutor = Pick<typeof db, "insert">;

export async function writeAuditLog(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>,
  executor: AuditLogExecutor = db,
) {
  await executor.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorId,
    action,
    entityType,
    entityId,
    ...(details ? { details } : {}),
  });
}

export async function findUserByIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(
      or(
        sql`LOWER(TRIM(${users.username})) = ${normalized}`,
        sql`LOWER(TRIM(${users.email})) = ${normalized}`,
      ),
    );
  return user ?? null;
}

export { asAuthUser };
