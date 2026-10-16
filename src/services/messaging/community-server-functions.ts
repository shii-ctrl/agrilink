import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const messageInput = z.object({ message: z.string().trim().min(1).max(4_000) });
const commentInput = z.object({
  messageId: z.string().uuid(),
  message: z.string().trim().min(1).max(2_000),
});
const reactionInput = z.object({
  messageId: z.string().uuid(),
  reaction: z.enum(["like", "dislike"]),
});
const reactionRemovalInput = z.object({ messageId: z.string().uuid() });

async function assertCommunityMessageExists(messageId: string) {
  const { db } = await import("@/db/client.server");
  const { communityMessages } = await import("@/db/schema");
  const [message] = await db
    .select({ id: communityMessages.id })
    .from(communityMessages)
    .where(eq(communityMessages.id, messageId));
  if (!message) throw new Error("This community post is no longer available.");
}

export const getCommunityMessages = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAnyRole } = await import("@/services/auth/auth-server");
  const viewer = await requireAnyRole(["Management", "Marketer", "Farmer", "Farm Consultant"]);
  const { db } = await import("@/db/client.server");
  const { communityComments, communityMessages, communityReactions, roles, userRoles, users } =
    await import("@/db/schema");
  const messageRows = await db
    .select({
      id: communityMessages.id,
      message: communityMessages.message,
      createdAt: communityMessages.createdAt,
      authorId: communityMessages.authorId,
      author: users.displayName,
    })
    .from(communityMessages)
    .innerJoin(users, eq(communityMessages.authorId, users.id))
    .orderBy(desc(communityMessages.createdAt))
    .limit(100);

  if (messageRows.length === 0) return [];

  const messageIds = messageRows.map((message) => message.id);
  const authorIds = [...new Set(messageRows.map((message) => message.authorId))];
  const [roleRows, reactionRows, commentRows] = await Promise.all([
    db
      .select({ userId: userRoles.userId, role: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(inArray(userRoles.userId, authorIds)),
    db
      .select({
        messageId: communityReactions.messageId,
        userId: communityReactions.userId,
        reaction: communityReactions.reaction,
      })
      .from(communityReactions)
      .where(inArray(communityReactions.messageId, messageIds)),
    db
      .select({
        id: communityComments.id,
        messageId: communityComments.messageId,
        message: communityComments.message,
        createdAt: communityComments.createdAt,
        author: users.displayName,
      })
      .from(communityComments)
      .innerJoin(users, eq(communityComments.authorId, users.id))
      .where(inArray(communityComments.messageId, messageIds))
      .orderBy(asc(communityComments.createdAt)),
  ]);

  const roleByUserId = new Map<string, string>();
  for (const row of roleRows) {
    if (!roleByUserId.has(row.userId)) roleByUserId.set(row.userId, row.role);
  }

  const reactionsByMessageId = new Map<
    string,
    { likes: number; dislikes: number; viewerReaction: "like" | "dislike" | null }
  >();
  for (const row of reactionRows) {
    const reaction = reactionsByMessageId.get(row.messageId) ?? {
      likes: 0,
      dislikes: 0,
      viewerReaction: null,
    };
    if (row.reaction === "like") reaction.likes += 1;
    else reaction.dislikes += 1;
    if (row.userId === viewer.id) reaction.viewerReaction = row.reaction;
    reactionsByMessageId.set(row.messageId, reaction);
  }

  const commentsByMessageId = new Map<
    string,
    Array<{ id: string; message: string; author: string; time: string }>
  >();
  for (const comment of commentRows) {
    const comments = commentsByMessageId.get(comment.messageId) ?? [];
    comments.push({
      id: comment.id,
      message: comment.message,
      author: comment.author,
      time: comment.createdAt.toISOString(),
    });
    commentsByMessageId.set(comment.messageId, comments);
  }

  return messageRows.map((message) => ({
    id: message.id,
    message: message.message,
    author: message.author,
    role: roleByUserId.get(message.authorId) ?? "Community member",
    time: message.createdAt.toISOString(),
    reactions: reactionsByMessageId.get(message.id) ?? {
      likes: 0,
      dislikes: 0,
      viewerReaction: null,
    },
    comments: commentsByMessageId.get(message.id) ?? [],
  }));
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

export const setCommunityReaction = createServerFn({ method: "POST" })
  .validator(reactionInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const user = await requireAnyRole(["Management", "Marketer", "Farmer", "Farm Consultant"]);
    await assertCommunityMessageExists(data.messageId);
    const { db } = await import("@/db/client.server");
    const { communityReactions } = await import("@/db/schema");
    await db
      .insert(communityReactions)
      .values({
        id: crypto.randomUUID(),
        messageId: data.messageId,
        userId: user.id,
        reaction: data.reaction,
      })
      .onDuplicateKeyUpdate({ set: { reaction: data.reaction, updatedAt: new Date() } });
    await writeAuditLog(
      user.id,
      `community.reaction.${data.reaction}`,
      "community_message",
      data.messageId,
    );
    return { reaction: data.reaction };
  });

export const removeCommunityReaction = createServerFn({ method: "POST" })
  .validator(reactionRemovalInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const user = await requireAnyRole(["Management", "Marketer", "Farmer", "Farm Consultant"]);
    const { db } = await import("@/db/client.server");
    const { communityReactions } = await import("@/db/schema");
    await db
      .delete(communityReactions)
      .where(
        and(
          eq(communityReactions.messageId, data.messageId),
          eq(communityReactions.userId, user.id),
        ),
      );
    await writeAuditLog(user.id, "community.reaction.remove", "community_message", data.messageId);
    return { removed: true };
  });

export const postCommunityComment = createServerFn({ method: "POST" })
  .validator(commentInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const author = await requireAnyRole(["Management", "Marketer", "Farmer", "Farm Consultant"]);
    await assertCommunityMessageExists(data.messageId);
    const { db } = await import("@/db/client.server");
    const { communityComments } = await import("@/db/schema");
    const id = crypto.randomUUID();
    await db.insert(communityComments).values({
      id,
      messageId: data.messageId,
      authorId: author.id,
      message: data.message,
    });
    await writeAuditLog(author.id, "community.comment", "community_message", data.messageId, {
      commentId: id,
    });
    return { id };
  });
