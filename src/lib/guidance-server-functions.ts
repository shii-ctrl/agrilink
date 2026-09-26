import { and, asc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const messageInput = z.object({ message: z.string().trim().min(1).max(4_000) });
const consultantMessageInput = messageInput.extend({ farmerId: z.string().uuid() });

async function activeUsersForRole(roleName: "Farmer" | "Farm Consultant") {
  const { db } = await import("@/db/client.server");
  const { roles, userRoles, users } = await import("@/db/schema");
  return db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(users.active, true), eq(roles.name, roleName)));
}

async function guidanceRows(farmerId?: string) {
  const { db } = await import("@/db/client.server");
  const { guidanceMessages, roles, userRoles, users } = await import("@/db/schema");
  const rows = await db
    .select({
      id: guidanceMessages.id,
      message: guidanceMessages.message,
      createdAt: guidanceMessages.createdAt,
      farmerId: guidanceMessages.farmerId,
      farmer: users.displayName,
    })
    .from(guidanceMessages)
    .innerJoin(users, eq(guidanceMessages.farmerId, users.id))
    .where(farmerId ? eq(guidanceMessages.farmerId, farmerId) : undefined)
    .orderBy(asc(guidanceMessages.createdAt));
  const authorRows = await db
    .select({ id: users.id, name: users.displayName, role: roles.name })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id));
  const authors = new Map(authorRows.map((author) => [author.id, author]));
  const fullRows = await db
    .select({ id: guidanceMessages.id, authorId: guidanceMessages.authorId })
    .from(guidanceMessages)
    .where(farmerId ? eq(guidanceMessages.farmerId, farmerId) : undefined);
  const authorByMessage = new Map(fullRows.map((row) => [row.id, authors.get(row.authorId)]));
  return rows.map((row) => ({
    ...row,
    author: authorByMessage.get(row.id)?.name ?? "Unknown user",
    role: authorByMessage.get(row.id)?.role ?? "",
    time: row.createdAt.toISOString(),
  }));
}

export const getFarmerGuidance = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/lib/auth-server");
  const farmer = await requireRole("Farmer");
  return guidanceRows(farmer.id);
});

export const sendFarmerGuidanceMessage = createServerFn({ method: "POST" })
  .validator(messageInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
    const farmer = await requireRole("Farmer");
    const [consultant] = await activeUsersForRole("Farm Consultant");
    if (!consultant)
      throw new Error("Create an active Farm Consultant account before sending guidance.");
    const { db } = await import("@/db/client.server");
    const { guidanceMessages } = await import("@/db/schema");
    const id = crypto.randomUUID();
    await db.insert(guidanceMessages).values({
      id,
      farmerId: farmer.id,
      consultantId: consultant.id,
      authorId: farmer.id,
      message: data.message,
    });
    await writeAuditLog(farmer.id, "guidance.farmer_message", "guidance_message", id);
    return { id };
  });

export const getConsultantGuidanceWorkspace = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireRole } = await import("@/lib/auth-server");
    await requireRole("Farm Consultant");
    const [farmers, messages] = await Promise.all([activeUsersForRole("Farmer"), guidanceRows()]);
    return { farmers, messages };
  },
);

export const sendConsultantGuidanceMessage = createServerFn({ method: "POST" })
  .validator(consultantMessageInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
    const consultant = await requireRole("Farm Consultant");
    const farmers = await activeUsersForRole("Farmer");
    if (!farmers.some((farmer) => farmer.id === data.farmerId))
      throw new Error("Choose an active Farmer account.");
    const { db } = await import("@/db/client.server");
    const { guidanceMessages } = await import("@/db/schema");
    const id = crypto.randomUUID();
    await db.insert(guidanceMessages).values({
      id,
      farmerId: data.farmerId,
      consultantId: consultant.id,
      authorId: consultant.id,
      message: data.message,
    });
    await writeAuditLog(consultant.id, "guidance.consultant_message", "guidance_message", id, {
      farmerId: data.farmerId,
    });
    return { id };
  });
