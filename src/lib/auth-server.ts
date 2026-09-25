import { and, eq, gt, isNull, or } from "drizzle-orm";
import { deleteCookie, getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";

import { db } from "@/db/client.server";
import { auditLogs, authSessions, roles, userRoles, users } from "@/db/schema";

export const sessionCookieName = "agrilink_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  contact: string | null;
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
  return `${getRequestIP() ?? "unknown"}:${identifier.trim().toLowerCase()}`;
}

export function assertLoginAllowed(identifier: string) {
  const record = loginAttempts.get(getAttemptKey(identifier));
  if (record && record.resetAt > Date.now() && record.count >= 5) {
    throw new Error("Too many sign-in attempts. Please wait 15 minutes and try again.");
  }
}

export function registerFailedLogin(identifier: string) {
  const key = getAttemptKey(identifier);
  const current = loginAttempts.get(key);
  const resetAt = Date.now() + 15 * 60 * 1000;
  loginAttempts.set(key, {
    count: current && current.resetAt > Date.now() ? current.count + 1 : 1,
    resetAt,
  });
}

export function clearFailedLogins(identifier: string) {
  loginAttempts.delete(getAttemptKey(identifier));
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

export async function writeAuditLog(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({
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
    .where(or(eq(users.username, normalized), eq(users.email, normalized)));
  return user ?? null;
}

export { asAuthUser };
