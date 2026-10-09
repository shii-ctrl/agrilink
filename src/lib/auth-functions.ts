import { createServerFn } from "@tanstack/react-start";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { securePassword } from "@/lib/password-policy";

const loginInput = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(8).max(200),
});
const registrationInput = z.object({
  name: z.string().trim().min(2).max(160),
  contact: z.string().trim().min(5).max(80),
  email: z.string().trim().email().max(255),
  password: securePassword,
});
const httpsImageUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((value) => new URL(value).protocol === "https:", {
    message: "Use an HTTPS image URL.",
  });
const profileInput = z.object({
  displayName: z.string().trim().min(2).max(160),
  contact: z.string().trim().min(5).max(80).nullable(),
  avatarUrl: httpsImageUrl.nullable(),
});
const strongPassword = securePassword;
const changePasswordInput = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: strongPassword,
});
const requestPasswordResetInput = z.object({
  email: z.string().trim().email().max(255),
});
const completePasswordResetInput = z.object({
  email: z.string().trim().email().max(255),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
  newPassword: strongPassword,
});

const passwordResetLifetimeMs = 10 * 60 * 1000;
const passwordResetRequestRateLimit = {
  maxAttempts: 3,
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
};
const passwordResetVerificationRateLimit = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
};
const registrationRateLimit = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
};

function getPasswordResetRequestKey(email: string) {
  return email.trim().toLowerCase();
}

async function consumeResetVerificationAttempt(key: string) {
  const { consumeRateLimit } = await import("@/lib/auth-server");
  await consumeRateLimit("password-reset-verify", key, passwordResetVerificationRateLimit);
}

async function hashPasswordResetCode(code: string) {
  const crypto = await import("node:crypto");
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function sendPasswordResetCode(email: string, code: string) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"];
  if (!apiKey || !from) {
    throw new Error("Password recovery email is not configured. Contact Management for help.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your AgriLink password reset code",
      text: `Your AgriLink password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Your AgriLink password reset code is:</p><p style="font-size: 28px; font-weight: 700; letter-spacing: 4px">${code}</p><p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) {
    console.error("Password reset email delivery failed", { status: response.status });
    throw new Error("Could not send a reset code right now. Please try again later.");
  }
}

export const getCurrentSessionUser = createServerFn({ method: "GET" }).handler(async () =>
  (await import("@/lib/auth-server")).getCurrentUser(),
);

export const updateCurrentProfile = createServerFn({ method: "POST" })
  .validator(profileInput)
  .handler(async ({ data }) => {
    const { db } = await import("@/db/client.server");
    const { users } = await import("@/db/schema");
    const { requireUser, writeAuditLog } = await import("@/lib/auth-server");
    const user = await requireUser();
    await db
      .update(users)
      .set({
        displayName: data.displayName,
        contact: data.contact,
        avatarUrl: data.avatarUrl,
      })
      .where(eq(users.id, user.id));
    await writeAuditLog(user.id, "user.profile.update", "user", user.id);
    return {
      ...user,
      displayName: data.displayName,
      contact: data.contact,
      avatarUrl: data.avatarUrl,
    };
  });

export const changeCurrentPassword = createServerFn({ method: "POST" })
  .validator(changePasswordInput)
  .handler(async ({ data }) => {
    const bcrypt = (await import("bcryptjs")).default;
    const { db } = await import("@/db/client.server");
    const { authSessions, users } = await import("@/db/schema");
    const { createSession, requireUser, writeAuditLog } = await import("@/lib/auth-server");
    const user = await requireUser();
    await db.transaction(async (tx) => {
      const [stored] = await tx.select().from(users).where(eq(users.id, user.id));
      if (!stored || !(await bcrypt.compare(data.currentPassword, stored.passwordHash))) {
        throw new Error("Your current password is incorrect.");
      }
      if (await bcrypt.compare(data.newPassword, stored.passwordHash)) {
        throw new Error("Choose a new password that is different from your current password.");
      }
      const now = new Date();
      await tx
        .update(users)
        .set({ passwordHash: await bcrypt.hash(data.newPassword, 12) })
        .where(eq(users.id, user.id));
      await tx
        .update(authSessions)
        .set({ revokedAt: now })
        .where(and(eq(authSessions.userId, user.id), isNull(authSessions.revokedAt)));
    });
    // Keep this browser signed in with a new session while every older session is invalidated.
    await createSession(user.id);
    await writeAuditLog(user.id, "auth.password.change", "user", user.id);
    return { ok: true };
  });

export const requestPasswordResetCode = createServerFn({ method: "POST" })
  .validator(requestPasswordResetInput)
  .handler(async ({ data }) => {
    if (!process.env["RESEND_API_KEY"] || !process.env["EMAIL_FROM"]) {
      throw new Error("Password recovery email is not configured. Contact Management for help.");
    }
    const email = data.email.toLowerCase();
    const { clearRateLimit, consumeRateLimit, getRequestRateLimitKey } =
      await import("@/lib/auth-server");
    const requestKey = getPasswordResetRequestKey(email);
    const requestSource = getRequestRateLimitKey();
    const [emailAllowed, sourceAllowed] = await Promise.all([
      consumeRateLimit("password-reset-request-email", requestKey, passwordResetRequestRateLimit),
      consumeRateLimit(
        "password-reset-request-source",
        requestSource,
        passwordResetRequestRateLimit,
      ),
    ]);
    // Keep the response identical when a request is throttled, so it does not reveal account data.
    if (!emailAllowed || !sourceAllowed) return { ok: true };
    const now = Date.now();

    const { db } = await import("@/db/client.server");
    const { passwordResetTokens, users } = await import("@/db/schema");
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.email, email), eq(users.active, true)));

    // Return the same response for unknown emails so the endpoint does not disclose accounts.
    if (!user) return { ok: true };

    const crypto = await import("node:crypto");
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(now + passwordResetLifetimeMs);
    await db.transaction(async (tx) => {
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
      await tx.insert(passwordResetTokens).values({
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: await hashPasswordResetCode(code),
        expiresAt,
      });
    });

    try {
      await sendPasswordResetCode(user.email, code);
      await clearRateLimit("password-reset-verify", `${requestSource}:${requestKey}`);
    } catch (error) {
      await db
        .delete(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        );
      await Promise.all([
        clearRateLimit("password-reset-request-email", requestKey),
        clearRateLimit("password-reset-request-source", requestSource),
      ]);
      throw error;
    }
    return { ok: true };
  });

export const completePasswordReset = createServerFn({ method: "POST" })
  .validator(completePasswordResetInput)
  .handler(async ({ data }) => {
    const bcrypt = (await import("bcryptjs")).default;
    const { db } = await import("@/db/client.server");
    const { authSessions, passwordResetTokens, users } = await import("@/db/schema");
    const {
      clearFailedLogins,
      clearRateLimit,
      getRequestRateLimitKey,
      isRateLimitAvailable,
      writeAuditLog,
    } = await import("@/lib/auth-server");
    const email = data.email.toLowerCase();
    const verificationKey = `${getRequestRateLimitKey()}:${getPasswordResetRequestKey(email)}`;
    if (!(await isRateLimitAvailable("password-reset-verify", verificationKey))) {
      throw new Error("The reset code is invalid or has expired.");
    }
    const now = new Date();
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), eq(users.active, true)));
    if (!user) {
      await consumeResetVerificationAttempt(verificationKey);
      throw new Error("The reset code is invalid or has expired.");
    }

    const [token] = await db
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          eq(passwordResetTokens.tokenHash, await hashPasswordResetCode(data.code)),
          gt(passwordResetTokens.expiresAt, now),
          isNull(passwordResetTokens.usedAt),
        ),
      );
    if (!token) {
      await consumeResetVerificationAttempt(verificationKey);
      throw new Error("The reset code is invalid or has expired.");
    }

    await db.transaction(async (tx) => {
      // Lock the token before checking it again so it cannot reset two passwords at once.
      await tx.execute(sql`SELECT id FROM password_reset_tokens WHERE id = ${token.id} FOR UPDATE`);
      const [usableToken] = await tx
        .select({ id: passwordResetTokens.id })
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.id, token.id),
            eq(passwordResetTokens.userId, user.id),
            gt(passwordResetTokens.expiresAt, now),
            isNull(passwordResetTokens.usedAt),
          ),
        );
      if (!usableToken) throw new Error("The reset code is invalid or has expired.");
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(passwordResetTokens.id, usableToken.id));
      await tx
        .update(users)
        .set({ passwordHash: await bcrypt.hash(data.newPassword, 12) })
        .where(eq(users.id, user.id));
      await tx
        .update(authSessions)
        .set({ revokedAt: now })
        .where(and(eq(authSessions.userId, user.id), isNull(authSessions.revokedAt)));
    });
    await Promise.all([
      clearRateLimit("password-reset-verify", verificationKey),
      clearFailedLogins(email),
    ]);
    await writeAuditLog(user.id, "auth.password.reset.email_otp", "user", user.id);
    return { ok: true };
  });

export const loginUser = createServerFn({ method: "POST" })
  .validator(loginInput)
  .handler(async ({ data }) => {
    const bcrypt = (await import("bcryptjs")).default;
    const {
      asAuthUser,
      assertLoginAllowed,
      clearFailedLogins,
      createSession,
      findUserByIdentifier,
      getRequestRateLimitKey,
      registerFailedLogin,
      writeAuditLog,
    } = await import("@/lib/auth-server");
    await assertLoginAllowed(data.identifier, getRequestRateLimitKey());
    const user = await findUserByIdentifier(data.identifier);
    const passwordValid = user ? await bcrypt.compare(data.password, user.passwordHash) : false;
    if (!user || !user.active || !passwordValid) {
      await registerFailedLogin(data.identifier, getRequestRateLimitKey());
      throw new Error("Invalid username/email or password.");
    }
    await clearFailedLogins(data.identifier);
    await createSession(user.id);
    await writeAuditLog(user.id, "auth.login", "user", user.id);
    return asAuthUser(user);
  });

export const registerBuyer = createServerFn({ method: "POST" })
  .validator(registrationInput)
  .handler(async ({ data }) => {
    const bcrypt = (await import("bcryptjs")).default;
    const { db } = await import("@/db/client.server");
    const { roles, userRoles, users } = await import("@/db/schema");
    const {
      consumeRateLimit,
      createSession,
      findUserByIdentifier,
      getRequestRateLimitKey,
      writeAuditLog,
    } = await import("@/lib/auth-server");
    if (
      !(await consumeRateLimit(
        "buyer-registration",
        getRequestRateLimitKey(),
        registrationRateLimit,
      ))
    ) {
      throw new Error("Too many account creation attempts. Please wait 15 minutes and try again.");
    }
    const email = data.email.toLowerCase();
    const existing = await findUserByIdentifier(email);
    if (existing)
      throw new Error("An account already exists for that email. Please sign in instead.");
    const [buyerRole] = await db.select().from(roles).where(eq(roles.name, "Buyer"));
    if (!buyerRole)
      throw new Error("Buyer role is not configured. Ask Management to initialize the system.");
    const user = {
      id: crypto.randomUUID(),
      username: email,
      email,
      displayName: data.name,
      contact: data.contact,
      passwordHash: await bcrypt.hash(data.password, 12),
    };
    await db.transaction(async (tx) => {
      await tx.insert(users).values(user);
      await tx.insert(userRoles).values({ userId: user.id, roleId: buyerRole.id });
    });
    await createSession(user.id);
    await writeAuditLog(user.id, "auth.register", "user", user.id, { role: "Buyer" });
    // Never expose password hashes or other database-only user fields to the browser.
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      contact: user.contact,
      roles: ["Buyer"],
    };
  });

export const logoutUser = createServerFn({ method: "POST" }).handler(async () => {
  const { requireUser, revokeCurrentSession, writeAuditLog } = await import("@/lib/auth-server");
  const user = await requireUser().catch(() => null);
  await revokeCurrentSession();
  if (user) await writeAuditLog(user.id, "auth.logout", "user", user.id);
  return { ok: true };
});
