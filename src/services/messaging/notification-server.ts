import { and, eq, inArray } from "drizzle-orm";

type NotificationDetails = { title: string; message: string; target?: string };

const communityRoles = ["Management", "Marketer", "Farmer", "Farm Consultant"] as const;

const communityTargetByRole: Record<(typeof communityRoles)[number], string> = {
  Management: "/management/community",
  Marketer: "/marketer/community",
  Farmer: "/farmer/community",
  "Farm Consultant": "/consultant/community",
};

export async function notifyUser(userId: string, details: NotificationDetails) {
  const { db } = await import("@/db/client.server");
  const { notifications } = await import("@/db/schema");
  await db.insert(notifications).values({ id: crypto.randomUUID(), userId, ...details });
}

export async function notifyRole(
  roleName: string,
  details: NotificationDetails,
  options: { excludeUserId?: string } = {},
) {
  const { db } = await import("@/db/client.server");
  const { roles, userRoles, users, notifications } = await import("@/db/schema");
  const recipients = await db
    .select({ userId: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(roles.name, roleName), eq(users.active, true)));
  const activeRecipients = recipients.filter(({ userId }) => userId !== options.excludeUserId);
  if (activeRecipients.length) {
    await db
      .insert(notifications)
      .values(
        activeRecipients.map(({ userId }) => ({ id: crypto.randomUUID(), userId, ...details })),
      );
  }
}

/** Notifies active buyers who need to update a cart because one listing changed availability. */
export async function notifyCartHoldersForListing(listingId: string, details: NotificationDetails) {
  const { db } = await import("@/db/client.server");
  const { cartItems, carts, notifications, users } = await import("@/db/schema");
  const rows = await db
    .select({ userId: users.id })
    .from(cartItems)
    .innerJoin(carts, eq(cartItems.cartId, carts.id))
    .innerJoin(users, eq(carts.buyerId, users.id))
    .where(and(eq(cartItems.listingId, listingId), eq(users.active, true)));
  const recipientIds = [...new Set(rows.map(({ userId }) => userId))];
  if (!recipientIds.length) return;
  await db
    .insert(notifications)
    .values(recipientIds.map((userId) => ({ id: crypto.randomUUID(), userId, ...details })));
}

/**
 * Sends a community notification to active Community members only. Each recipient gets a
 * destination that matches their own workspace, rather than a link that may be forbidden.
 */
export async function notifyCommunityUsers(
  details: Omit<NotificationDetails, "target">,
  options: { excludeUserId?: string; userIds?: string[] } = {},
) {
  if (options.userIds?.length === 0) return;

  const { db } = await import("@/db/client.server");
  const { roles, userRoles, users, notifications } = await import("@/db/schema");
  const conditions = [
    eq(users.active, true),
    inArray(roles.name, [...communityRoles]),
    options.userIds ? inArray(users.id, options.userIds) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select({ userId: users.id, role: roles.name })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(...conditions));

  const recipients = new Map<string, (typeof communityRoles)[number]>();
  for (const row of rows) {
    if (row.userId === options.excludeUserId) continue;
    if (communityRoles.includes(row.role as (typeof communityRoles)[number])) {
      recipients.set(row.userId, row.role as (typeof communityRoles)[number]);
    }
  }
  if (!recipients.size) return;

  await db.insert(notifications).values(
    Array.from(recipients, ([userId, role]) => ({
      id: crypto.randomUUID(),
      userId,
      ...details,
      target: communityTargetByRole[role],
    })),
  );
}
