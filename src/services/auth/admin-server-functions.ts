import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { alias } from "drizzle-orm/mysql-core";
import { z } from "zod";

import { securePassword } from "@/services/auth/password-policy";

const internalRole = z.enum(["Management", "Marketer", "Accounting", "Rider"]);
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
const deleteUserInput = z.object({
  userId: z.string().uuid(),
});
const removeUserAvatarInput = z.object({
  userId: z.string().uuid(),
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
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .orderBy(asc(users.displayName));
});

export const removeManagedUserAvatar = createServerFn({ method: "POST" })
  .validator(removeUserAvatarInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { users } = await import("@/db/schema");
    const [target] = await db
      .select({ id: users.id, name: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, data.userId));
    if (!target) throw new Error("The selected account no longer exists.");
    if (!target.avatarUrl) return { removed: false };
    await db.update(users).set({ avatarUrl: null }).where(eq(users.id, data.userId));
    await writeAuditLog(actor.id, "user.avatar.remove", "user", data.userId, {
      name: target.name,
    });
    return { removed: true };
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

export const deleteManagedUser = createServerFn({ method: "POST" })
  .validator(deleteUserInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Management");
    if (actor.id === data.userId) {
      throw new Error("You cannot delete your own Management account.");
    }

    const { db } = await import("@/db/client.server");
    const {
      auditLogs,
      authSessions,
      carts,
      cartItems,
      communityCommentReactions,
      communityComments,
      communityMessages,
      communityReactions,
      dailyPrices,
      directMessages,
      inventory,
      inventoryMovements,
      notifications,
      orderStatusHistory,
      orders,
      passwordResetTokens,
      payments,
      receivingRecords,
      roles,
      savedDrafts,
      userRoles,
      users,
    } = await import("@/db/schema");

    const target = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id = ${data.userId} FOR UPDATE`);
      const [user] = await tx
        .select({ id: users.id, name: users.displayName, role: roles.name })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(users.id, data.userId));
      if (!user) throw new Error("The selected account no longer exists.");

      if (user.role === "Management") {
        await tx.execute(sql`SELECT id FROM roles WHERE name = ${"Management"} FOR UPDATE`);
        const managementAccounts = await tx
          .select({ id: users.id })
          .from(users)
          .innerJoin(userRoles, eq(userRoles.userId, users.id))
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(roles.name, "Management"));
        if (managementAccounts.length <= 1) {
          throw new Error("Keep at least one Management account.");
        }
      }

      const businessRecords = await Promise.all([
        tx.select({ id: orders.id }).from(orders).where(eq(orders.buyerId, user.id)).limit(1),
        tx
          .select({ id: payments.id })
          .from(payments)
          .where(eq(payments.recordedById, user.id))
          .limit(1),
        tx
          .select({ id: dailyPrices.id })
          .from(dailyPrices)
          .where(eq(dailyPrices.createdById, user.id))
          .limit(1),
        tx
          .select({ id: inventory.id })
          .from(inventory)
          .where(eq(inventory.farmerId, user.id))
          .limit(1),
        tx
          .select({ id: receivingRecords.id })
          .from(receivingRecords)
          .where(
            or(eq(receivingRecords.farmerId, user.id), eq(receivingRecords.recordedById, user.id)),
          )
          .limit(1),
        tx
          .select({ id: inventoryMovements.id })
          .from(inventoryMovements)
          .where(eq(inventoryMovements.recordedById, user.id))
          .limit(1),
        tx
          .select({ id: orderStatusHistory.id })
          .from(orderStatusHistory)
          .where(eq(orderStatusHistory.changedById, user.id))
          .limit(1),
      ]);
      if (businessRecords.some((records) => records.length > 0)) {
        throw new Error(
          "This account has saved operational history. Deactivate it instead to keep AgriLink records accurate.",
        );
      }

      const authoredPosts = await tx
        .select({ id: communityMessages.id })
        .from(communityMessages)
        .where(eq(communityMessages.authorId, user.id));
      const authoredPostIds = authoredPosts.map((post) => post.id);
      const userCarts = await tx
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.buyerId, user.id));

      await tx.delete(communityReactions).where(eq(communityReactions.userId, user.id));
      await tx
        .delete(communityCommentReactions)
        .where(eq(communityCommentReactions.userId, user.id));
      const authoredComments = await tx
        .select({ id: communityComments.id })
        .from(communityComments)
        .where(eq(communityComments.authorId, user.id));
      if (authoredComments.length) {
        await tx.delete(communityCommentReactions).where(
          inArray(
            communityCommentReactions.commentId,
            authoredComments.map((comment) => comment.id),
          ),
        );
      }
      await tx.delete(communityComments).where(eq(communityComments.authorId, user.id));
      if (authoredPostIds.length) {
        await tx
          .delete(communityReactions)
          .where(inArray(communityReactions.messageId, authoredPostIds));
        const postComments = await tx
          .select({ id: communityComments.id })
          .from(communityComments)
          .where(inArray(communityComments.messageId, authoredPostIds));
        if (postComments.length) {
          await tx.delete(communityCommentReactions).where(
            inArray(
              communityCommentReactions.commentId,
              postComments.map((comment) => comment.id),
            ),
          );
        }
        await tx
          .delete(communityComments)
          .where(inArray(communityComments.messageId, authoredPostIds));
        await tx.delete(communityMessages).where(inArray(communityMessages.id, authoredPostIds));
      }

      await tx
        .delete(directMessages)
        .where(or(eq(directMessages.senderId, user.id), eq(directMessages.recipientId, user.id)));
      await tx.delete(notifications).where(eq(notifications.userId, user.id));
      await tx.delete(authSessions).where(eq(authSessions.userId, user.id));
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
      await tx.delete(savedDrafts).where(eq(savedDrafts.userId, user.id));
      if (userCarts.length) {
        await tx.delete(cartItems).where(
          inArray(
            cartItems.cartId,
            userCarts.map((cart) => cart.id),
          ),
        );
        await tx.delete(carts).where(eq(carts.buyerId, user.id));
      }
      await tx.update(auditLogs).set({ actorId: null }).where(eq(auditLogs.actorId, user.id));
      await tx.delete(userRoles).where(eq(userRoles.userId, user.id));
      await tx.delete(users).where(eq(users.id, user.id));
      return user;
    });

    await writeAuditLog(actor.id, "user.delete", "user", target.id, {
      name: target.name,
      role: target.role,
    });
    const { notifyRole } = await import("@/services/messaging/notification-server");
    await notifyRole(
      "Management",
      {
        title: "User account deleted",
        message: `${target.name}'s ${target.role} account was permanently deleted by Management.`,
        target: "/management/users",
      },
      { excludeUserId: actor.id },
    );
    return { id: target.id };
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
