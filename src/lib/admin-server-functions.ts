import { asc, eq, or, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const internalRole = z.enum(["Management", "Marketer", "Accounting", "Farmer", "Farm Consultant"]);
const createUserInput = z.object({
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
  role: internalRole,
  active: z.boolean(),
});
const resetUserPasswordInput = z.object({
  userId: z.string().uuid(),
  password: z
    .string()
    .min(12, "Use at least 12 characters.")
    .max(200)
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/\d/, "Include a number."),
});
const bootstrapInput = createUserInput
  .pick({ name: true, contact: true, email: true, password: true })
  .extend({
    setupSecret: z.string().min(24).max(512),
  });

export const createInitialManagementAccount = createServerFn({ method: "POST" })
  .validator(bootstrapInput)
  .handler(async ({ data }) => {
    const configuredSecret = process.env["INITIAL_MANAGEMENT_SETUP_SECRET"];
    if (!configuredSecret)
      throw new Error("Initial Management setup is not enabled on this server.");
    const crypto = await import("node:crypto");
    const submitted = Buffer.from(data.setupSecret);
    const expected = Buffer.from(configuredSecret);
    if (submitted.length !== expected.length || !crypto.timingSafeEqual(submitted, expected)) {
      throw new Error("Initial Management setup could not be completed.");
    }
    const bcrypt = (await import("bcryptjs")).default;
    const { db } = await import("@/db/client.server");
    const { roles, userRoles, users } = await import("@/db/schema");
    const email = data.email.toLowerCase();
    return db.transaction(async (tx) => {
      // Lock the role row so simultaneous first-setup requests cannot each observe an empty system.
      await tx.execute(sql`SELECT id FROM roles WHERE name = ${"Management"} FOR UPDATE`);
      const [managementRole] = await tx.select().from(roles).where(eq(roles.name, "Management"));
      if (!managementRole) throw new Error("Management role is not configured.");
      const existingManagement = await tx
        .select({ id: users.id })
        .from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .where(eq(userRoles.roleId, managementRole.id));
      if (existingManagement.length)
        throw new Error("A Management account already exists. Sign in instead.");
      const id = crypto.randomUUID();
      await tx.insert(users).values({
        id,
        username: email,
        email,
        displayName: data.name,
        contact: data.contact,
        passwordHash: await bcrypt.hash(data.password, 12),
        active: true,
      });
      await tx.insert(userRoles).values({ userId: id, roleId: managementRole.id });
      return { id, email };
    });
  });

export const getManagementUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/lib/auth-server");
  await requireRole("Management");
  const { db } = await import("@/db/client.server");
  const { roles, userRoles, users } = await import("@/db/schema");
  return db
    .select({
      id: users.id,
      name: users.displayName,
      contact: users.contact,
      email: users.email,
      active: users.active,
      role: roles.name,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .orderBy(asc(users.displayName));
});

export const createManagementUser = createServerFn({ method: "POST" })
  .validator(createUserInput)
  .handler(async ({ data }) => {
    const bcrypt = (await import("bcryptjs")).default;
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
    const actor = await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { roles, userRoles, users } = await import("@/db/schema");
    const email = data.email.toLowerCase();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, email)));
    if (existing) throw new Error("An account already exists for that email.");
    const [role] = await db.select().from(roles).where(eq(roles.name, data.role));
    if (!role) throw new Error("The selected role is not configured.");
    const id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id,
        username: email,
        email,
        displayName: data.name,
        contact: data.contact,
        active: data.active,
        passwordHash: await bcrypt.hash(data.password, 12),
      });
      await tx.insert(userRoles).values({ userId: id, roleId: role.id });
    });
    await writeAuditLog(actor.id, "user.create", "user", id, { role: data.role });
    return { id, name: data.name, role: data.role };
  });

export const resetManagedUserPassword = createServerFn({ method: "POST" })
  .validator(resetUserPasswordInput)
  .handler(async ({ data }) => {
    const bcrypt = (await import("bcryptjs")).default;
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
    const actor = await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { users } = await import("@/db/schema");
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, data.userId));
    if (!target) throw new Error("The selected account no longer exists.");
    await db
      .update(users)
      .set({ passwordHash: await bcrypt.hash(data.password, 12) })
      .where(eq(users.id, data.userId));
    await writeAuditLog(actor.id, "user.password.reset", "user", data.userId);
    return { ok: true };
  });
