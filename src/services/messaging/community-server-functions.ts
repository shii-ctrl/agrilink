import { desc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const messageInput = z.object({ message: z.string().trim().min(1).max(4_000) });

export const getCommunityMessages = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAnyRole } = await import("@/services/auth/auth-server");
  await requireAnyRole(["Management", "Marketer", "Farmer", "Farm Consultant"]);
  const { db } = await import("@/db/client.server");
  const { communityMessages, roles, userRoles, users } = await import("@/db/schema");
  const rows = await db
    .select({
      id: communityMessages.id,
      message: communityMessages.message,
      createdAt: communityMessages.createdAt,
      author: users.displayName,
      role: roles.name,
    })
    .from(communityMessages)
    .innerJoin(users, eq(communityMessages.authorId, users.id))
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .orderBy(desc(communityMessages.createdAt))
    .limit(100);
  return rows.map((row) => ({ ...row, time: row.createdAt.toISOString() }));
});

export const postCommunityMessage = createServerFn({ method: "POST" })
  .validator(messageInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const author = await requireAnyRole(["Management", "Marketer", "Farmer", "Farm Consultant"]);
    const { db } = await import("@/db/client.server");
    const { communityMessages } = await import("@/db/schema");
    const id = crypto.randomUUID();
    await db.insert(communityMessages).values({ id, authorId: author.id, message: data.message });
    await writeAuditLog(author.id, "community.post", "community_message", id);
    return { id };
  });
