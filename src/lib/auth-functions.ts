import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

const loginInput = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(8).max(200),
});
const registrationInput = z.object({
  name: z.string().trim().min(2).max(160),
  contact: z.string().trim().min(5).max(80),
  email: z.string().trim().email().max(255),
  password: z
    .string()
    .min(12, "Use at least 12 characters.")
    .max(200)
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/\d/, "Include a number."),
});

export const getCurrentSessionUser = createServerFn({ method: "GET" }).handler(async () =>
  (await import("@/lib/auth-server")).getCurrentUser(),
);

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
      registerFailedLogin,
      writeAuditLog,
    } = await import("@/lib/auth-server");
    assertLoginAllowed(data.identifier);
    const user = await findUserByIdentifier(data.identifier);
    const passwordValid = user ? await bcrypt.compare(data.password, user.passwordHash) : false;
    if (!user || !user.active || !passwordValid) {
      registerFailedLogin(data.identifier);
      throw new Error("Invalid username/email or password.");
    }
    clearFailedLogins(data.identifier);
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
    const { createSession, findUserByIdentifier, writeAuditLog } =
      await import("@/lib/auth-server");
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
