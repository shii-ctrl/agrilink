import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
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
const messageInput = conversationInput.extend({ message: z.string().trim().min(1).max(4_000) });

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
};

const workspaceByRole: Record<MessagingRole, string> = {
  Management: "/management/community",
  Marketer: "/marketer/community",
  Accounting: "/accounting/community",
  Farmer: "/farmer/community",
  Buyer: "/buyer/community",
  Rider: "/rider/community",
};

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
      .where(and(eq(orders.buyerId, viewer.id), isNotNull(orders.assignedRiderId)));
    assignedRiders.forEach((row) => {
      if (row.id) ids.add(row.id);
    });
  }
  if (viewer.roles.includes("Rider")) {
    const { orders } = await import("@/db/schema");
    const assignedBuyers = await db
      .select({ id: orders.buyerId })
      .from(orders)
      .where(eq(orders.assignedRiderId, viewer.id));
    assignedBuyers.forEach((row) => ids.add(row.id));
  }
  ids.delete(viewer.id);
  return ids;
}

async function conversationContactIds(viewerId: string) {
  const { db } = await import("@/db/client.server");
  const { directMessages } = await import("@/db/schema");
  const rows = await db
    .select({ senderId: directMessages.senderId, recipientId: directMessages.recipientId })
    .from(directMessages)
    .where(or(eq(directMessages.senderId, viewerId), eq(directMessages.recipientId, viewerId)));
  return new Set(rows.map((row) => (row.senderId === viewerId ? row.recipientId : row.senderId)));
}

async function contactsForViewer(viewer: MessagingUser): Promise<Contact[]> {
  const { db } = await import("@/db/client.server");
  const { roles, userRoles, users } = await import("@/db/schema");
  const [allowedIds, existingIds] = await Promise.all([
    directRecipientIds(viewer),
    conversationContactIds(viewer.id),
  ]);
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
      // Buyers may start a thread only with a Rider assigned to one of their orders.
      // Existing permitted conversations remain replyable without exposing unrelated accounts.
      canSend:
        allowedIds.has(row.id) || (viewer.roles.includes("Buyer") && existingIds.has(row.id)),
    };
    current.roles.push(row.role);
    current.role = displayRole(current.roles);
    contacts.set(row.id, current);
  }
  return [...contacts.values()]
    .map(({ roles: _roles, ...contact }) => contact)
    .sort((left, right) => left.name.localeCompare(right.name));
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
  return { contacts: await contactsForViewer(viewer) };
});

export const getDirectConversation = createServerFn({ method: "GET" })
  .validator(conversationInput)
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
    const rows = await db
      .select({
        id: directMessages.id,
        senderId: directMessages.senderId,
        message: directMessages.message,
        createdAt: directMessages.createdAt,
      })
      .from(directMessages)
      .where(condition)
      .orderBy(asc(directMessages.createdAt));
    await db
      .update(directMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(directMessages.senderId, data.participantId),
          eq(directMessages.recipientId, viewer.id),
          isNull(directMessages.readAt),
        ),
      );
    return rows.map((row) => ({
      id: row.id,
      message: row.message,
      isMine: row.senderId === viewer.id,
      time: row.createdAt.toISOString(),
    }));
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
    const id = crypto.randomUUID();
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
