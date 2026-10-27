import { and, asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const messageInput = z.object({ message: z.string().trim().min(1).max(4_000) });
const commentInput = z.object({
  messageId: z.string().uuid(),
  parentCommentId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(2_000),
});
const reactionInput = z.object({
  messageId: z.string().uuid(),
  reaction: z.enum(["like", "dislike"]),
});
const reactionRemovalInput = z.object({ messageId: z.string().uuid() });
const commentReactionInput = z.object({
  commentId: z.string().uuid(),
  reaction: z.enum(["like", "dislike"]),
});
const commentReactionRemovalInput = z.object({ commentId: z.string().uuid() });
const commentRemovalInput = z.object({ commentId: z.string().uuid() });
const communityFeedInput = z.object({
  query: z.string().trim().max(120).default(""),
  offset: z.number().int().min(0).max(100_000).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
});
const postUpdateInput = messageInput.extend({ messageId: z.string().uuid() });
const postRemovalInput = z.object({ messageId: z.string().uuid() });
const communityRoles = [
  "Management",
  "Marketer",
  "Accounting",
  "Farmer",
];

async function assertCommunityMessageExists(messageId: string) {
  const { db } = await import("@/db/client.server");
  const { communityMessages } = await import("@/db/schema");
  const [message] = await db
    .select({ id: communityMessages.id, authorId: communityMessages.authorId })
    .from(communityMessages)
    .where(eq(communityMessages.id, messageId));
  if (!message) throw new Error("This community post is no longer available.");
  return message;
}

async function assertCommunityCommentExists(commentId: string) {
  const { db } = await import("@/db/client.server");
  const { communityComments } = await import("@/db/schema");
  const [comment] = await db
    .select({
      id: communityComments.id,
      authorId: communityComments.authorId,
      messageId: communityComments.messageId,
      parentCommentId: communityComments.parentCommentId,
    })
    .from(communityComments)
    .where(eq(communityComments.id, commentId));
  if (!comment) throw new Error("This Community comment is no longer available.");
  return comment;
}

function searchPattern(query: string) {
  return query
    ? `%${query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`
    : null;
}

async function communityMessagesForViewer(
  viewer: { id: string },
  options: { authorId?: string; query?: string; offset?: number; pageSize?: number } = {},
) {
  const { db } = await import("@/db/client.server");
  const {
    communityCommentReactions,
    communityComments,
    communityMessages,
    communityReactions,
    roles,
    userRoles,
    users,
  } = await import("@/db/schema");
  const pattern = searchPattern(options.query ?? "");
  const queryFilter = pattern
    ? or(like(communityMessages.message, pattern), like(users.displayName, pattern))
    : undefined;
  const where =
    options.authorId && queryFilter
      ? and(eq(communityMessages.authorId, options.authorId), queryFilter)
      : options.authorId
        ? eq(communityMessages.authorId, options.authorId)
        : queryFilter;
  const pageSize = options.pageSize ?? 25;
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
    .where(where)
    .orderBy(desc(communityMessages.createdAt))
    .limit(pageSize + 1)
    .offset(options.offset ?? 0);

  const hasMore = messageRows.length > pageSize;
  const pageRows = hasMore ? messageRows.slice(0, pageSize) : messageRows;
  if (pageRows.length === 0) {
    return { messages: [], hasMore: false, nextOffset: null };
  }

  const messageIds = pageRows.map((message) => message.id);
  const authorIds = [...new Set(pageRows.map((message) => message.authorId))];
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
        parentCommentId: communityComments.parentCommentId,
        authorId: communityComments.authorId,
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

  const commentIds = commentRows.map((comment) => comment.id);
  const commentReactionRows = commentIds.length
    ? await db
        .select({
          commentId: communityCommentReactions.commentId,
          userId: communityCommentReactions.userId,
          reaction: communityCommentReactions.reaction,
        })
        .from(communityCommentReactions)
        .where(inArray(communityCommentReactions.commentId, commentIds))
    : [];

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
    Array<{
      id: string;
      message: string;
      parentCommentId: string | null;
      isOwner: boolean;
      author: string;
      time: string;
      reactions: { likes: number; dislikes: number; viewerReaction: "like" | "dislike" | null };
    }>
  >();
  const reactionsByCommentId = new Map<
    string,
    { likes: number; dislikes: number; viewerReaction: "like" | "dislike" | null }
  >();
  for (const row of commentReactionRows) {
    const reaction = reactionsByCommentId.get(row.commentId) ?? {
      likes: 0,
      dislikes: 0,
      viewerReaction: null,
    };
    if (row.reaction === "like") reaction.likes += 1;
    else reaction.dislikes += 1;
    if (row.userId === viewer.id) reaction.viewerReaction = row.reaction;
    reactionsByCommentId.set(row.commentId, reaction);
  }
  for (const comment of commentRows) {
    const comments = commentsByMessageId.get(comment.messageId) ?? [];
    comments.push({
      id: comment.id,
      message: comment.message,
      parentCommentId: comment.parentCommentId,
      isOwner: comment.authorId === viewer.id,
      author: comment.author,
      time: comment.createdAt.toISOString(),
      reactions: reactionsByCommentId.get(comment.id) ?? {
        likes: 0,
        dislikes: 0,
        viewerReaction: null,
      },
    });
    commentsByMessageId.set(comment.messageId, comments);
  }

  return {
    messages: pageRows.map((message) => ({
      id: message.id,
      isOwner: message.authorId === viewer.id,
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
    })),
    hasMore,
    nextOffset: hasMore ? (options.offset ?? 0) + pageRows.length : null,
  };
}

export const getCommunityMessages = createServerFn({ method: "GET" })
  .validator(communityFeedInput)
  .handler(async ({ data }) => {
    const { requireAnyRole } = await import("@/services/auth/auth-server");
    const viewer = await requireAnyRole(communityRoles);
    return communityMessagesForViewer(viewer, data);
  });

export const getMyCommunityMessages = createServerFn({ method: "GET" })
  .validator(communityFeedInput)
  .handler(async ({ data }) => {
    const { requireAnyRole } = await import("@/services/auth/auth-server");
    const viewer = await requireAnyRole(communityRoles);
    return communityMessagesForViewer(viewer, { ...data, authorId: viewer.id });
  });

export const postCommunityMessage = createServerFn({ method: "POST" })
  .validator(messageInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const author = await requireAnyRole(communityRoles);
    const { db } = await import("@/db/client.server");
    const { communityMessages } = await import("@/db/schema");
    const id = crypto.randomUUID();
    await db.insert(communityMessages).values({ id, authorId: author.id, message: data.message });
    const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
    await notifyCommunityUsers(
      {
        title: "New Community post",
        message: `${author.displayName} shared an update in Community.`,
      },
      { excludeUserId: author.id },
    );
    await writeAuditLog(author.id, "community.post", "community_message", id);
    return { id };
  });

export const updateCommunityMessage = createServerFn({ method: "POST" })
  .validator(postUpdateInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const author = await requireAnyRole(communityRoles);
    const post = await assertCommunityMessageExists(data.messageId);
    if (post.authorId !== author.id) throw new Error("You can only edit your own Community posts.");

    const { db } = await import("@/db/client.server");
    const { communityMessages } = await import("@/db/schema");
    await db
      .update(communityMessages)
      .set({ message: data.message, updatedAt: new Date() })
      .where(
        and(eq(communityMessages.id, data.messageId), eq(communityMessages.authorId, author.id)),
      );
    await writeAuditLog(author.id, "community.update", "community_message", data.messageId);
    return { id: data.messageId };
  });

export const deleteCommunityMessage = createServerFn({ method: "POST" })
  .validator(postRemovalInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const author = await requireAnyRole(communityRoles);
    const post = await assertCommunityMessageExists(data.messageId);
    if (post.authorId !== author.id)
      throw new Error("You can only delete your own Community posts.");

    const { db } = await import("@/db/client.server");
    const { communityCommentReactions, communityComments, communityMessages, communityReactions } =
      await import("@/db/schema");
    await db.transaction(async (tx) => {
      const comments = await tx
        .select({ id: communityComments.id })
        .from(communityComments)
        .where(eq(communityComments.messageId, data.messageId));
      if (comments.length) {
        await tx
          .delete(communityCommentReactions)
          .where(inArray(communityCommentReactions.commentId, comments.map((comment) => comment.id)));
      }
      await tx.delete(communityComments).where(eq(communityComments.messageId, data.messageId));
      await tx.delete(communityReactions).where(eq(communityReactions.messageId, data.messageId));
      await tx
        .delete(communityMessages)
        .where(
          and(eq(communityMessages.id, data.messageId), eq(communityMessages.authorId, author.id)),
        );
    });
    await writeAuditLog(author.id, "community.delete", "community_message", data.messageId);
    return { id: data.messageId };
  });

export const setCommunityReaction = createServerFn({ method: "POST" })
  .validator(reactionInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const user = await requireAnyRole(communityRoles);
    const post = await assertCommunityMessageExists(data.messageId);
    const { db } = await import("@/db/client.server");
    const { communityReactions } = await import("@/db/schema");
    const [previousReaction] = await db
      .select({ reaction: communityReactions.reaction })
      .from(communityReactions)
      .where(
        and(
          eq(communityReactions.messageId, data.messageId),
          eq(communityReactions.userId, user.id),
        ),
      );
    await db
      .insert(communityReactions)
      .values({
        id: crypto.randomUUID(),
        messageId: data.messageId,
        userId: user.id,
        reaction: data.reaction,
      })
      .onDuplicateKeyUpdate({ set: { reaction: data.reaction, updatedAt: new Date() } });
    if (post.authorId !== user.id && previousReaction?.reaction !== data.reaction) {
      const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
      await notifyCommunityUsers(
        {
          title: `New ${data.reaction}`,
          message: `${user.displayName} ${data.reaction}d your Community post.`,
        },
        { userIds: [post.authorId] },
      );
    }
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
    const user = await requireAnyRole(communityRoles);
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

export const setCommunityCommentReaction = createServerFn({ method: "POST" })
  .validator(commentReactionInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const user = await requireAnyRole(communityRoles);
    const comment = await assertCommunityCommentExists(data.commentId);
    const { db } = await import("@/db/client.server");
    const { communityCommentReactions } = await import("@/db/schema");
    const [previousReaction] = await db
      .select({ reaction: communityCommentReactions.reaction })
      .from(communityCommentReactions)
      .where(
        and(
          eq(communityCommentReactions.commentId, data.commentId),
          eq(communityCommentReactions.userId, user.id),
        ),
      );
    await db
      .insert(communityCommentReactions)
      .values({
        id: crypto.randomUUID(),
        commentId: data.commentId,
        userId: user.id,
        reaction: data.reaction,
      })
      .onDuplicateKeyUpdate({ set: { reaction: data.reaction, updatedAt: new Date() } });
    if (comment.authorId !== user.id && previousReaction?.reaction !== data.reaction) {
      const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
      await notifyCommunityUsers(
        {
          title: `New ${data.reaction} on your comment`,
          message: `${user.displayName} ${data.reaction}d your Community comment.`,
        },
        { userIds: [comment.authorId] },
      );
    }
    await writeAuditLog(
      user.id,
      `community.comment_reaction.${data.reaction}`,
      "community_comment",
      data.commentId,
    );
    return { reaction: data.reaction };
  });

export const removeCommunityCommentReaction = createServerFn({ method: "POST" })
  .validator(commentReactionRemovalInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const user = await requireAnyRole(communityRoles);
    const { db } = await import("@/db/client.server");
    const { communityCommentReactions } = await import("@/db/schema");
    await db
      .delete(communityCommentReactions)
      .where(
        and(
          eq(communityCommentReactions.commentId, data.commentId),
          eq(communityCommentReactions.userId, user.id),
        ),
      );
    await writeAuditLog(user.id, "community.comment_reaction.remove", "community_comment", data.commentId);
    return { removed: true };
  });

export const deleteCommunityComment = createServerFn({ method: "POST" })
  .validator(commentRemovalInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const author = await requireAnyRole(communityRoles);
    const comment = await assertCommunityCommentExists(data.commentId);
    if (comment.authorId !== author.id) {
      throw new Error("You can only delete your own Community comments and replies.");
    }
    const { db } = await import("@/db/client.server");
    const { communityCommentReactions, communityComments } = await import("@/db/schema");
    await db.transaction(async (tx) => {
      await tx
        .delete(communityCommentReactions)
        .where(eq(communityCommentReactions.commentId, data.commentId));
      await tx
        .delete(communityComments)
        .where(
          and(eq(communityComments.id, data.commentId), eq(communityComments.authorId, author.id)),
        );
    });
    await writeAuditLog(author.id, "community.comment.delete", "community_comment", data.commentId);
    return { id: data.commentId };
  });

export const postCommunityComment = createServerFn({ method: "POST" })
  .validator(commentInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const author = await requireAnyRole(communityRoles);
    const post = await assertCommunityMessageExists(data.messageId);
    const parent = data.parentCommentId
      ? await assertCommunityCommentExists(data.parentCommentId)
      : null;
    if (parent && (parent.messageId !== data.messageId || parent.parentCommentId)) {
      throw new Error("Replies must belong to a top-level comment on this Community post.");
    }
    const { db } = await import("@/db/client.server");
    const { communityComments } = await import("@/db/schema");
    const id = crypto.randomUUID();
    await db.insert(communityComments).values({
      id,
      messageId: data.messageId,
      parentCommentId: parent?.id ?? null,
      authorId: author.id,
      message: data.message,
    });
    if (parent && parent.authorId !== author.id) {
      const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
      await notifyCommunityUsers(
        {
          title: "New reply to your comment",
          message: `${author.displayName} replied to your Community comment.`,
        },
        { userIds: [parent.authorId] },
      );
    } else if (!parent && post.authorId !== author.id) {
      const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
      await notifyCommunityUsers(
        {
          title: "New comment on your post",
          message: `${author.displayName} commented on your Community post.`,
        },
        { userIds: [post.authorId] },
      );
    }
    await writeAuditLog(author.id, "community.comment", "community_message", data.messageId, {
      commentId: id,
      parentCommentId: parent?.id ?? null,
    });
    return { id };
  });
