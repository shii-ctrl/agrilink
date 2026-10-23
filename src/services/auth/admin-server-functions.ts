import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { alias } from "drizzle-orm/mysql-core";
import { z } from "zod";

import { securePassword } from "@/services/auth/password-policy";

const internalRole = z.enum(["Management", "Marketer", "Accounting", "Farmer", "Farm Consultant"]);
const createUserInput = z.object({
  name: z.string().trim().min(2).max(160),
  contact: z.string().trim().min(5).max(80),
  email: z.string().trim().email().max(255),
  password: securePassword,
  role: internalRole,
  active: z.boolean(),
});
const resetUserPasswordInput = z.object({
  userId: z.string().uuid(),
  password: securePassword,
});
const setUserActiveInput = z.object({
  userId: z.string().uuid(),
  active: z.boolean(),
});
const guidanceAssignmentInput = z.object({
  farmerId: z.string().uuid(),
  consultantId: z.string().uuid(),
});
const bootstrapInput = createUserInput
  .pick({ name: true, contact: true, email: true, password: true })
  .extend({
    setupSecret: z.string().min(24).max(512),
  });
const initialManagementSetupRateLimit = {
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000,
  lockMs: 60 * 60 * 1000,
};

export const createInitialManagementAccount = createServerFn({ method: "POST" })
  .validator(bootstrapInput)
  .handler(async ({ data }) => {
    const configuredSecret = process.env["INITIAL_MANAGEMENT_SETUP_SECRET"];
    if (!configuredSecret)
      throw new Error("Initial Management setup is not enabled on this server.");
    const { consumeRateLimit, getRequestRateLimitKey } =
      await import("@/services/auth/auth-server");
    if (
      !(await consumeRateLimit(
        "initial-management-setup",
        getRequestRateLimitKey(),
        initialManagementSetupRateLimit,
      ))
    ) {
      throw new Error("Initial Management setup could not be completed.");
    }
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
  const { requireRole } = await import("@/services/auth/auth-server");
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

export const setManagedUserActive = createServerFn({ method: "POST" })
  .validator(setUserActiveInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Management");
    if (actor.id === data.userId) {
      throw new Error("You cannot deactivate your own Management account.");
    }
    const { db } = await import("@/db/client.server");
    const { authSessions, roles, userRoles, users } = await import("@/db/schema");
    const [target] = await db
      .select({ id: users.id, name: users.displayName, active: users.active, role: roles.name })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(users.id, data.userId));
    if (!target) throw new Error("The selected account no longer exists.");
    if (target.active === data.active) return { active: data.active };

    await db.transaction(async (tx) => {
      if (!data.active && target.role === "Management") {
        // Serialize Management changes so there is always at least one active administrator.
        await tx.execute(sql`SELECT id FROM roles WHERE name = ${"Management"} FOR UPDATE`);
        const activeManagement = await tx
          .select({ id: users.id })
          .from(users)
          .innerJoin(userRoles, eq(userRoles.userId, users.id))
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(and(eq(roles.name, "Management"), eq(users.active, true)));
        if (activeManagement.length <= 1) {
          throw new Error("Keep at least one active Management account.");
        }
      }
      await tx.update(users).set({ active: data.active }).where(eq(users.id, data.userId));
      if (!data.active) {
        await tx
          .update(authSessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(authSessions.userId, data.userId), isNull(authSessions.revokedAt)));
      }
    });
    await writeAuditLog(
      actor.id,
      data.active ? "user.activate" : "user.deactivate",
      "user",
      data.userId,
    );
    const { notifyRole, notifyUser } = await import("@/services/messaging/notification-server");
    if (data.active) {
      await notifyUser(target.id, {
        title: "Account activated",
        message: "Your AgriLink account is active. You can sign in again.",
        target: "/login",
      });
    } else {
      await notifyRole(
        "Management",
        {
          title: "Account deactivated",
          message: `${target.name}'s ${target.role} account was deactivated and active sessions were signed out.`,
          target: "/management/users",
        },
        { excludeUserId: actor.id },
      );
    }
    return { active: data.active };
  });

export const getManagementAuditLogs = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Management");
  const { db } = await import("@/db/client.server");
  const { auditLogs, users } = await import("@/db/schema");
  const actor = alias(users, "audit_actor");
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      actor: actor.displayName,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(actor, eq(auditLogs.actorId, actor.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);
});

export const getGuidanceAssignments = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Management");
  const { db } = await import("@/db/client.server");
  const { farmerConsultantAssignments, roles, userRoles, users } = await import("@/db/schema");
  const activeRoleUsers = (roleName: "Farmer" | "Farm Consultant") =>
    db
      .select({ id: users.id, name: users.displayName })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(users.active, true), eq(roles.name, roleName)))
      .orderBy(asc(users.displayName));
  const [farmers, consultants, assignments] = await Promise.all([
    activeRoleUsers("Farmer"),
    activeRoleUsers("Farm Consultant"),
    db.select().from(farmerConsultantAssignments),
  ]);
  const consultantByFarmer = new Map(
    assignments.map((assignment) => [assignment.farmerId, assignment.consultantId]),
  );
  return {
    farmers: farmers.map((farmer) => ({
      ...farmer,
      consultantId: consultantByFarmer.get(farmer.id) ?? null,
    })),
    consultants,
  };
});

export const setGuidanceAssignment = createServerFn({ method: "POST" })
  .validator(guidanceAssignmentInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { farmerConsultantAssignments, roles, userRoles, users } = await import("@/db/schema");
    const findActiveRoleUser = (id: string, roleName: "Farmer" | "Farm Consultant") =>
      db
        .select({ id: users.id })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(and(eq(users.id, id), eq(users.active, true), eq(roles.name, roleName)));
    const [[farmer], [consultant]] = await Promise.all([
      findActiveRoleUser(data.farmerId, "Farmer"),
      findActiveRoleUser(data.consultantId, "Farm Consultant"),
    ]);
    if (!farmer) throw new Error("Choose an active Farmer account.");
    if (!consultant) throw new Error("Choose an active Farm Consultant account.");
    await db
      .insert(farmerConsultantAssignments)
      .values({ farmerId: farmer.id, consultantId: consultant.id, assignedById: actor.id })
      .onDuplicateKeyUpdate({
        set: { consultantId: consultant.id, assignedById: actor.id },
      });
    await writeAuditLog(actor.id, "guidance.assignment.set", "farmer", farmer.id, {
      consultantId: consultant.id,
    });
    return { farmerId: farmer.id, consultantId: consultant.id };
  });

export const createManagementUser = createServerFn({ method: "POST" })
  .validator(createUserInput)
  .handler(async ({ data }) => {
    const bcrypt = (await import("bcryptjs")).default;
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
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
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { authSessions, users } = await import("@/db/schema");
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, data.userId));
    if (!target) throw new Error("The selected account no longer exists.");
    await db.transaction(async (tx) => {
      const now = new Date();
      await tx
        .update(users)
        .set({ passwordHash: await bcrypt.hash(data.password, 12) })
        .where(eq(users.id, data.userId));
      await tx
        .update(authSessions)
        .set({ revokedAt: now })
        .where(and(eq(authSessions.userId, data.userId), isNull(authSessions.revokedAt)));
    });
    await writeAuditLog(actor.id, "user.password.reset", "user", data.userId);
    return { ok: true };
  });
