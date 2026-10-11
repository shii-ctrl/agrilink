import { and, asc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const messageInput = z.object({ message: z.string().trim().min(1).max(4_000) });
const consultantMessageInput = messageInput.extend({ farmerId: z.string().uuid() });

async function assignedConsultantForFarmer(farmerId: string) {
  const { db } = await import("@/db/client.server");
  const { farmerConsultantAssignments, roles, userRoles, users } = await import("@/db/schema");
  const [assignment] = await db
    .select({ id: users.id, name: users.displayName })
    .from(farmerConsultantAssignments)
    .innerJoin(users, eq(farmerConsultantAssignments.consultantId, users.id))
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(
      and(
        eq(farmerConsultantAssignments.farmerId, farmerId),
        eq(users.active, true),
        eq(roles.name, "Farm Consultant"),
      ),
    );
  return assignment ?? null;
}

async function guidanceRows(filters: { farmerId?: string; consultantId?: string } = {}) {
  const { db } = await import("@/db/client.server");
  const { guidanceMessages, roles, userRoles, users } = await import("@/db/schema");
  const conditions = [
    filters.farmerId ? eq(guidanceMessages.farmerId, filters.farmerId) : undefined,
    filters.consultantId ? eq(guidanceMessages.consultantId, filters.consultantId) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select({
      id: guidanceMessages.id,
      message: guidanceMessages.message,
      createdAt: guidanceMessages.createdAt,
      farmerId: guidanceMessages.farmerId,
      farmer: users.displayName,
      authorId: guidanceMessages.authorId,
    })
    .from(guidanceMessages)
    .innerJoin(users, eq(guidanceMessages.farmerId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(guidanceMessages.createdAt));
  const authorRows = await db
    .select({ id: users.id, name: users.displayName, role: roles.name })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id));
  const authors = new Map(authorRows.map((author) => [author.id, author]));
  return rows.map((row) => ({
    ...row,
    author: authors.get(row.authorId)?.name ?? "Unknown user",
    role: authors.get(row.authorId)?.role ?? "",
    time: row.createdAt.toISOString(),
  }));
}

export const getFarmerGuidance = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const farmer = await requireRole("Farmer");
  return guidanceRows({ farmerId: farmer.id });
});

export const sendFarmerGuidanceMessage = createServerFn({ method: "POST" })
  .validator(messageInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const farmer = await requireRole("Farmer");
    const consultant = await assignedConsultantForFarmer(farmer.id);
    if (!consultant) {
      throw new Error("Management needs to assign a Farm Consultant before you can send guidance.");
    }
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
    const { requireRole } = await import("@/services/auth/auth-server");
    const consultant = await requireRole("Farm Consultant");
    const { db } = await import("@/db/client.server");
    const { farmerConsultantAssignments, users } = await import("@/db/schema");
    const farmers = await db
      .select({ id: users.id, name: users.displayName })
      .from(farmerConsultantAssignments)
      .innerJoin(users, eq(farmerConsultantAssignments.farmerId, users.id))
      .where(
        and(eq(farmerConsultantAssignments.consultantId, consultant.id), eq(users.active, true)),
      )
      .orderBy(asc(users.displayName));
    return { farmers, messages: await guidanceRows({ consultantId: consultant.id }) };
  },
);

export const sendConsultantGuidanceMessage = createServerFn({ method: "POST" })
  .validator(consultantMessageInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const consultant = await requireRole("Farm Consultant");
    const assignedConsultant = await assignedConsultantForFarmer(data.farmerId);
    if (!assignedConsultant || assignedConsultant.id !== consultant.id) {
      throw new Error("This Farmer is not assigned to your guidance workspace.");
    }
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
