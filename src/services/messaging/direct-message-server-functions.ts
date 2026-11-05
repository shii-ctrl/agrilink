import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const messagingRoles = [
  "Management",
  "Marketer",
  "Accounting",
  "Farmer",
  "Buyer",
  "Rider",
] as const;

const conversationInput = z.object({ participantId: z.string().uuid() });
const conversationReadInput = conversationInput.extend({ after: z.string().datetime().optional() });
const messageInput = conversationInput.extend({
  message: z.string().trim().min(1).max(4_000),
  clientMessageId: z.string().uuid().optional(),
});
const typingInput = conversationInput.extend({ isTyping: z.boolean() });

type MessagingRole = (typeof messagingRoles)[number];
type MessagingUser = {
  id: string;
  displayName: string;
  roles: string[];
};
type Contact = {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  canSend: boolean;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

const workspaceByRole: Record<MessagingRole, string> = {
  Management: "/management/community",
  Marketer: "/marketer/community",
  Accounting: "/accounting/community",
  Farmer: "/farmer/community",
  Buyer: "/buyer/community",
  Rider: "/rider/community",
};

const activeDeliveryStatuses = [
  "rider_assigned",
  "out_for_delivery",
  "delivery_failed",
  "rescheduled",
] as const;

function displayRole(roles: string[]) {
  return messagingRoles.find((role) => roles.includes(role)) ?? roles[0] ?? "AgriLink member";
}

async function directRecipientIds(viewer: MessagingUser) {
  const { db } = await import("@/db/client.server");
  const { roles, userRoles, users } = await import("@/db/schema");
  const ids = new Set<string>();

  const addRoleRecipients = async (roleNames: MessagingRole[]) => {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(users.active, true), inArray(roles.name, roleNames)));
    rows.forEach((row) => ids.add(row.id));
  };

  if (viewer.roles.includes("Management")) {
    await addRoleRecipients(["Marketer", "Accounting"]);
  }
  if (viewer.roles.includes("Marketer")) {
    await addRoleRecipients(["Farmer", "Buyer"]);
  }
  if (viewer.roles.includes("Farmer")) {
    // Farmers can find and start private conversations with other active Farmers.
    await addRoleRecipients(["Farmer"]);
  }
  if (viewer.roles.includes("Buyer")) {
    const { orders } = await import("@/db/schema");
    const assignedRiders = await db
      .select({ id: orders.assignedRiderId })
      .from(orders)
      .where(
        and(
          eq(orders.buyerId, viewer.id),
          isNotNull(orders.assignedRiderId),
          inArray(orders.fulfillmentStatus, [...activeDeliveryStatuses]),
        ),
      );
    assignedRiders.forEach((row) => {
      if (row.id) ids.add(row.id);
    });
  }
  if (viewer.roles.includes("Rider")) {
    const { orders } = await import("@/db/schema");
    const assignedBuyers = await db
      .select({ id: orders.buyerId })
      .from(orders)
      .where(
        and(
          eq(orders.assignedRiderId, viewer.id),
          inArray(orders.fulfillmentStatus, [...activeDeliveryStatuses]),
        ),
      );
    assignedBuyers.forEach((row) => ids.add(row.id));
  }
  ids.delete(viewer.id);
  return ids;
}

async function conversationSummaries(viewerId: string) {
  const { db } = await import("@/db/client.server");
  const { directMessages } = await import("@/db/schema");
  const contactId = sql<string>`CASE WHEN ${directMessages.senderId} = ${viewerId}
    THEN ${directMessages.recipientId} ELSE ${directMessages.senderId} END`;
  const ranked = db
    .select({
      contactId: contactId.as("contact_id"),
      message: directMessages.message,
      createdAt: directMessages.createdAt,
      unreadCount: sql<number>`SUM(CASE WHEN ${directMessages.recipientId} = ${viewerId}
        AND ${directMessages.readAt} IS NULL THEN 1 ELSE 0 END)
        OVER (PARTITION BY ${contactId})`.as("unread_count"),
      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${contactId}
        ORDER BY ${directMessages.createdAt} DESC, ${directMessages.id} DESC)`.as("message_rank"),
    })
    .from(directMessages)
    .where(or(eq(directMessages.senderId, viewerId), eq(directMessages.recipientId, viewerId)))
    .as("conversation_summaries");
  const rows = await db.select().from(ranked).where(eq(ranked.rank, 1));

  const summaries = new Map<
    string,
    { lastMessage: string; lastMessageAt: string; unreadCount: number }
  >();
  for (const row of rows) {
    summaries.set(row.contactId, {
      lastMessage: row.message,
      lastMessageAt: row.createdAt.toISOString(),
      unreadCount: Number(row.unreadCount),
    });
  }
  return summaries;
}

async function contactsForViewer(viewer: MessagingUser): Promise<Contact[]> {
  const { db } = await import("@/db/client.server");
  const { roles, userRoles, users } = await import("@/db/schema");
  const [allowedIds, summaries] = await Promise.all([
    directRecipientIds(viewer),
    conversationSummaries(viewer.id),
  ]);
  const existingIds = new Set(summaries.keys());
  const contactIds = [...new Set([...allowedIds, ...existingIds])];
  if (!contactIds.length) return [];

  const rows = await db
    .select({
      id: users.id,
      name: users.displayName,
      avatarUrl: users.avatarUrl,
      avatarVisibility: users.avatarVisibility,
      role: roles.name,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(users.active, true), inArray(users.id, contactIds)));

  const contacts = new Map<string, Contact & { roles: string[] }>();
  for (const row of rows) {
    const current = contacts.get(row.id) ?? {
      id: row.id,
      name: row.name,
      role: "AgriLink member",
      avatarUrl: row.avatarVisibility === "hidden" ? null : row.avatarUrl,
      roles: [],
      canSend:
        allowedIds.has(row.id) ||
        (!viewer.roles.includes("Buyer") &&
          !viewer.roles.includes("Rider") &&
          existingIds.has(row.id)),
      lastMessage: summaries.get(row.id)?.lastMessage ?? null,
      lastMessageAt: summaries.get(row.id)?.lastMessageAt ?? null,
      unreadCount: summaries.get(row.id)?.unreadCount ?? 0,
    };
    current.roles.push(row.role);
    current.role = displayRole(current.roles);
    contacts.set(row.id, current);
  }
  return [...contacts.values()]
    .map(({ roles: _roles, ...contact }) => contact)
    .sort((left, right) => {
      if (left.lastMessageAt && right.lastMessageAt) {
        return Date.parse(right.lastMessageAt) - Date.parse(left.lastMessageAt);
      }
      if (left.lastMessageAt) return -1;
      if (right.lastMessageAt) return 1;
      return left.name.localeCompare(right.name);
    });
}

async function findContact(viewer: MessagingUser, participantId: string) {
  const contacts = await contactsForViewer(viewer);
  const contact = contacts.find((item) => item.id === participantId);
  if (!contact) throw new Error("This private conversation is not available to you.");
  return contact;
}

async function currentMessagingUser() {
  const { requireAnyRole } = await import("@/services/auth/auth-server");
  return (await requireAnyRole([...messagingRoles])) as MessagingUser;
}

export const getDirectMessageWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = await currentMessagingUser();
  const { db } = await import("@/db/client.server");
  const { directMessages } = await import("@/db/schema");
  await db
    .update(directMessages)
    .set({ deliveredAt: new Date() })
    .where(and(eq(directMessages.recipientId, viewer.id), isNull(directMessages.deliveredAt)));
  return { contacts: await contactsForViewer(viewer) };
});

export const getDirectConversation = createServerFn({ method: "GET" })
  .validator(conversationReadInput)
  .handler(async ({ data }) => {
    const viewer = await currentMessagingUser();
    await findContact(viewer, data.participantId);
    const { db } = await import("@/db/client.server");
    const { directMessages } = await import("@/db/schema");
    const condition = or(
      and(
        eq(directMessages.senderId, viewer.id),
        eq(directMessages.recipientId, data.participantId),
      ),
      and(
        eq(directMessages.senderId, data.participantId),
        eq(directMessages.recipientId, viewer.id),
      ),
    );
    const openedAt = new Date();
    await db
      .update(directMessages)
      .set({ deliveredAt: openedAt, readAt: openedAt })
      .where(
        and(
          eq(directMessages.senderId, data.participantId),
          eq(directMessages.recipientId, viewer.id),
          isNull(directMessages.readAt),
        ),
      );
    const rows = await db
      .select({
        id: directMessages.id,
        senderId: directMessages.senderId,
        message: directMessages.message,
        deliveredAt: directMessages.deliveredAt,
        readAt: directMessages.readAt,
        createdAt: directMessages.createdAt,
      })
      .from(directMessages)
      .where(
        and(
          condition,
          data.after
            ? or(
                gte(directMessages.createdAt, new Date(Date.parse(data.after) - 1_000)),
                gte(directMessages.readAt, new Date(Date.parse(data.after) - 1_000)),
                gte(directMessages.deliveredAt, new Date(Date.parse(data.after) - 1_000)),
              )
            : undefined,
        ),
      )
      .orderBy(asc(directMessages.createdAt));
    return {
      syncedAt: openedAt.toISOString(),
      messages: rows.map((row) => ({
        id: row.id,
        message: row.message,
        isMine: row.senderId === viewer.id,
        time: row.createdAt.toISOString(),
        status: row.readAt ? "read" : row.deliveredAt ? "delivered" : "sent",
      })),
    };
  });

export const getDirectTyping = createServerFn({ method: "GET" })
  .validator(conversationInput)
  .handler(async ({ data }) => {
    const viewer = await currentMessagingUser();
    const contact = await findContact(viewer, data.participantId);
    const { db } = await import("@/db/client.server");
    const { directMessageTyping } = await import("@/db/schema");
    const [typing] = await db
      .select({ expiresAt: directMessageTyping.expiresAt })
      .from(directMessageTyping)
      .where(
        and(
          eq(directMessageTyping.userId, contact.id),
          eq(directMessageTyping.participantId, viewer.id),
          gt(directMessageTyping.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return { isTyping: Boolean(typing), name: contact.name };
  });

export const updateDirectTyping = createServerFn({ method: "POST" })
  .validator(typingInput)
  .handler(async ({ data }) => {
    const viewer = await currentMessagingUser();
    const contact = await findContact(viewer, data.participantId);
    if (!contact.canSend) return { active: false };
    const { db } = await import("@/db/client.server");
    const { directMessageTyping } = await import("@/db/schema");
    if (!data.isTyping) {
      await db
        .delete(directMessageTyping)
        .where(
          and(
            eq(directMessageTyping.userId, viewer.id),
            eq(directMessageTyping.participantId, contact.id),
          ),
        );
      return { active: false };
    }
    const expiresAt = new Date(Date.now() + 5_000);
    await db
      .insert(directMessageTyping)
      .values({ userId: viewer.id, participantId: contact.id, expiresAt })
      .onDuplicateKeyUpdate({ set: { expiresAt } });
    return { active: true };
  });

export const sendDirectMessage = createServerFn({ method: "POST" })
  .validator(messageInput)
  .handler(async ({ data }) => {
    const viewer = await currentMessagingUser();
    const contact = await findContact(viewer, data.participantId);
    if (!contact.canSend) {
      throw new Error("Your role cannot start a private message with this user.");
    }
    const { db } = await import("@/db/client.server");
    const { directMessages, roles, userRoles } = await import("@/db/schema");
    const id = data.clientMessageId ?? crypto.randomUUID();
    if (data.clientMessageId) {
      const [existing] = await db
        .select({ senderId: directMessages.senderId, recipientId: directMessages.recipientId })
        .from(directMessages)
        .where(eq(directMessages.id, id))
        .limit(1);
      if (existing) {
        if (existing.senderId !== viewer.id || existing.recipientId !== contact.id) {
          throw new Error("This message could not be retried safely.");
        }
        return { id };
      }
    }
    await db.insert(directMessages).values({
      id,
      senderId: viewer.id,
      recipientId: contact.id,
      message: data.message,
    });
    const recipientRoles = await db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, contact.id));
    const recipientRole = displayRole(recipientRoles.map((role) => role.name));
    const { notifyUser } = await import("@/services/messaging/notification-server");
    await notifyUser(contact.id, {
      title: "New private message",
      message: `${viewer.displayName} sent you a private message.`,
      target: `${workspaceByRole[recipientRole as MessagingRole] ?? "/"}?contact=${viewer.id}`,
    });
    const { writeAuditLog } = await import("@/services/auth/auth-server");
    await writeAuditLog(viewer.id, "direct_message.send", "direct_message", id, {
      recipientId: contact.id,
    });
    return { id };
  });
