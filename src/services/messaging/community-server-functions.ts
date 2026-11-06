import { and, asc, desc, eq, gte, inArray, like, ne, or, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  canPinCommunityPost,
  communityCommentsClosed,
  assertQuestionStatusChange,
} from "@/features/messaging/community-permissions";
import {
  communityCategoriesForRoles,
  communityPostCategories,
  communityPostCategoryLabels,
} from "@/features/messaging/community-categories";

const messageInput = z.object({
  category: z.enum(communityPostCategories),
  message: z.string().trim().min(1).max(4_000),
  attachments: z.array(z.string().startsWith("data:image/").max(500_000)).max(4).default([]),
});
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
  sort: z.enum(["latest", "discussed", "liked", "unanswered"]).default("latest"),
});
const postUpdateInput = z.object({
  messageId: z.string().uuid(),
  message: z.string().trim().min(1).max(4_000),
});
const postRemovalInput = z.object({ messageId: z.string().uuid() });
const postPinInput = z.object({ messageId: z.string().uuid(), pinned: z.boolean() });
const postBookmarkInput = z.object({ messageId: z.string().uuid(), saved: z.boolean() });
const postReportInput = z.object({
  messageId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
});
const postQuestionStatusInput = z.object({
  messageId: z.string().uuid(),
  status: z.enum(["open", "answered", "resolved"]),
  helpfulCommentId: z.string().uuid().nullable().optional(),
});
const moderationInput = z.object({
  messageId: z.string().uuid(),
  action: z.enum(["hide", "restore", "dismiss"]),
  reason: z.string().trim().max(500).default(""),
});
const communityRoles = ["Management", "Marketer", "Accounting", "Farmer"];

function normalizedMessage(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function mentionUsernames(value: string) {
  return [
    ...new Set(
      Array.from(value.matchAll(/(^|\s)@([a-zA-Z0-9._-]{2,50})\b/g), (match) =>
        String(match[2]).toLowerCase(),
      ),
    ),
  ];
}

async function notifyMentionedUsers(
  author: { id: string; displayName: string },
  text: string,
  messageId: string,
  commentId?: string,
) {
  const usernames = mentionUsernames(text);
  if (!usernames.length) return;
  const { db } = await import("@/db/client.server");
  const { users } = await import("@/db/schema");
  const mentioned = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(and(inArray(users.username, usernames), eq(users.active, true)));
  const userIds = mentioned.map((user) => user.id).filter((id) => id !== author.id);
  if (!userIds.length) return;
  const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
  await notifyCommunityUsers(
    {
      title: "You were mentioned in Community",
      message: `${author.displayName} mentioned you in a ${commentId ? "comment" : "post"}.`,
    },
    {
      userIds,
      targetSuffix: `?post=${messageId}${commentId ? `&comment=${commentId}` : ""}#community-${commentId ? `comment-${commentId}` : `post-${messageId}`}`,
    },
  );
}

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
  viewer: { id: string; roles: string[] },
  options: {
    authorId?: string;
    savedOnly?: boolean;
    query?: string;
    offset?: number;
    pageSize?: number;
    sort?: "latest" | "discussed" | "liked" | "unanswered";
  } = {},
) {
  const allowedCategories = communityCategoriesForRoles(viewer.roles);
  const { db } = await import("@/db/client.server");
  const {
    communityAttachments,
    communityBookmarks,
    communityCommentReactions,
    communityComments,
    communityMessages,
    communityReactions,
    communityReports,
    roles,
    userRoles,
    users,
  } = await import("@/db/schema");
  const pattern = searchPattern(options.query ?? "");
  const queryFilter = pattern
    ? or(like(communityMessages.message, pattern), like(users.displayName, pattern))
    : undefined;
  const visibleFilter = viewer.roles.includes("Management")
    ? undefined
    : eq(communityMessages.moderationStatus, "visible");
  const unansweredFilter =
    options.sort === "unanswered"
      ? and(
          eq(communityMessages.category, "question"),
          eq(communityMessages.questionStatus, "open"),
        )
      : undefined;
  const conditions = [
    options.authorId ? eq(communityMessages.authorId, options.authorId) : undefined,
    options.savedOnly ? eq(communityBookmarks.userId, viewer.id) : undefined,
    queryFilter,
    visibleFilter,
    unansweredFilter,
  ].filter(Boolean);
  const where = conditions.length ? and(...conditions) : undefined;
  const pageSize = options.pageSize ?? 25;
  const commentCount = sql<number>`(SELECT COUNT(*) FROM community_comments cc WHERE cc.message_id = ${communityMessages.id})`;
  const likeCount = sql<number>`(SELECT COUNT(*) FROM community_reactions cr WHERE cr.message_id = ${communityMessages.id} AND cr.reaction = 'like')`;
  const engagementOrder =
    options.sort === "discussed"
      ? desc(commentCount)
      : options.sort === "liked"
        ? desc(likeCount)
        : desc(communityMessages.createdAt);
  const messageRows = await db
    .select({
      id: communityMessages.id,
      category: communityMessages.category,
      isPinned: communityMessages.isPinned,
      pinnedAt: communityMessages.pinnedAt,
      questionStatus: communityMessages.questionStatus,
      helpfulCommentId: communityMessages.helpfulCommentId,
      moderationStatus: communityMessages.moderationStatus,
      moderationReason: communityMessages.moderationReason,
      message: communityMessages.message,
      createdAt: communityMessages.createdAt,
      authorId: communityMessages.authorId,
      author: users.displayName,
      authorAvatarUrl: users.avatarUrl,
      authorAvatarVisibility: users.avatarVisibility,
    })
    .from(communityMessages)
    .innerJoin(users, eq(communityMessages.authorId, users.id))
    .leftJoin(
      communityBookmarks,
      and(
        eq(communityBookmarks.messageId, communityMessages.id),
        eq(communityBookmarks.userId, viewer.id),
      ),
    )
    .where(where)
    .orderBy(
      desc(communityMessages.isPinned),
      desc(communityMessages.pinnedAt),
      engagementOrder,
      desc(communityMessages.createdAt),
    )
    .limit(pageSize + 1)
    .offset(options.offset ?? 0);

  const hasMore = messageRows.length > pageSize;
  const pageRows = hasMore ? messageRows.slice(0, pageSize) : messageRows;
  if (pageRows.length === 0) {
    return { messages: [], hasMore: false, nextOffset: null, allowedCategories };
  }

  const messageIds = pageRows.map((message) => message.id);
  const authorIds = [...new Set(pageRows.map((message) => message.authorId))];
  const [roleRows, reactionRows, commentRows, attachmentRows, bookmarkRows, reportRows] =
    await Promise.all([
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
          authorAvatarUrl: users.avatarUrl,
          authorAvatarVisibility: users.avatarVisibility,
        })
        .from(communityComments)
        .innerJoin(users, eq(communityComments.authorId, users.id))
        .where(inArray(communityComments.messageId, messageIds))
        .orderBy(asc(communityComments.createdAt)),
      db
        .select({
          id: communityAttachments.id,
          messageId: communityAttachments.messageId,
          imageUrl: communityAttachments.imageUrl,
          position: communityAttachments.position,
        })
        .from(communityAttachments)
        .where(inArray(communityAttachments.messageId, messageIds))
        .orderBy(asc(communityAttachments.position)),
      db
        .select({ messageId: communityBookmarks.messageId })
        .from(communityBookmarks)
        .where(
          and(
            eq(communityBookmarks.userId, viewer.id),
            inArray(communityBookmarks.messageId, messageIds),
          ),
        ),
      db
        .select({
          messageId: communityReports.messageId,
          reporterId: communityReports.reporterId,
          reason: communityReports.reason,
          createdAt: communityReports.createdAt,
        })
        .from(communityReports)
        .where(
          and(
            inArray(communityReports.messageId, messageIds),
            eq(communityReports.status, "pending"),
          ),
        ),
    ]);

  const attachmentsByMessageId = new Map<string, Array<{ id: string; imageUrl: string }>>();
  for (const attachment of attachmentRows) {
    const current = attachmentsByMessageId.get(attachment.messageId) ?? [];
    current.push({ id: attachment.id, imageUrl: attachment.imageUrl });
    attachmentsByMessageId.set(attachment.messageId, current);
  }
  const savedMessageIds = new Set(bookmarkRows.map((row) => row.messageId));
  const reportsByMessageId = new Map<
    string,
    { count: number; viewerReported: boolean; reasons: Array<{ reason: string; time: string }> }
  >();
  for (const report of reportRows) {
    const current = reportsByMessageId.get(report.messageId) ?? {
      count: 0,
      viewerReported: false,
      reasons: [],
    };
    current.count += 1;
    if (report.reporterId === viewer.id) current.viewerReported = true;
    if (viewer.roles.includes("Management")) {
      current.reasons.push({ reason: report.reason, time: report.createdAt.toISOString() });
    }
    reportsByMessageId.set(report.messageId, current);
  }

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
      authorAvatarUrl: string | null;
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
      authorAvatarUrl:
        comment.authorId === viewer.id || comment.authorAvatarVisibility !== "hidden"
          ? comment.authorAvatarUrl
          : null,
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
      category: message.category,
      isPinned: message.isPinned,
      pinnedAt: message.pinnedAt?.toISOString() ?? null,
      questionStatus: message.questionStatus,
      helpfulCommentId: message.helpfulCommentId,
      moderationStatus: message.moderationStatus,
      moderationReason: message.moderationReason,
      isOwner: message.authorId === viewer.id,
      canDelete: message.authorId === viewer.id || viewer.roles.includes("Management"),
      canPin: canPinCommunityPost(viewer.roles, message.category),
      canManageQuestion: viewer.roles.includes("Management") && message.category === "question",
      commentsClosed: communityCommentsClosed(message),
      canModerate: viewer.roles.includes("Management"),
      isSaved: savedMessageIds.has(message.id),
      reports: reportsByMessageId.get(message.id) ?? {
        count: 0,
        viewerReported: false,
        reasons: [],
      },
      attachments: attachmentsByMessageId.get(message.id) ?? [],
      message: message.message,
      author: message.author,
      authorAvatarUrl:
        message.authorId === viewer.id || message.authorAvatarVisibility !== "hidden"
          ? message.authorAvatarUrl
          : null,
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
    allowedCategories,
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

export const getSavedCommunityMessages = createServerFn({ method: "GET" })
  .validator(communityFeedInput)
  .handler(async ({ data }) => {
    const { requireAnyRole } = await import("@/services/auth/auth-server");
    const viewer = await requireAnyRole(communityRoles);
    return communityMessagesForViewer(viewer, { ...data, savedOnly: true });
  });

export const postCommunityMessage = createServerFn({ method: "POST" })
  .validator(messageInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const author = await requireAnyRole(communityRoles);
    const allowedCategories = communityCategoriesForRoles(author.roles);
    if (!allowedCategories.includes(data.category)) {
      throw new Error(
        `Your account role cannot publish ${communityPostCategoryLabels[data.category]} posts.`,
      );
    }
    const { db } = await import("@/db/client.server");
    const { communityAttachments, communityMessages } = await import("@/db/schema");
    const recent = await db
      .select({ message: communityMessages.message, createdAt: communityMessages.createdAt })
      .from(communityMessages)
      .where(
        and(
          eq(communityMessages.authorId, author.id),
          gte(communityMessages.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1_000)),
        ),
      )
      .orderBy(desc(communityMessages.createdAt))
      .limit(20);
    if (recent[0] && Date.now() - recent[0].createdAt.getTime() < 30_000) {
      throw new Error("Please wait 30 seconds before sharing another Community post.");
    }
    if (
      recent.some((post) => normalizedMessage(post.message) === normalizedMessage(data.message))
    ) {
      throw new Error("This looks like a duplicate of a post you recently shared.");
    }
    const id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx
        .insert(communityMessages)
        .values({ id, authorId: author.id, category: data.category, message: data.message });
      if (data.attachments.length) {
        await tx.insert(communityAttachments).values(
          data.attachments.map((imageUrl, position) => ({
            id: crypto.randomUUID(),
            messageId: id,
            imageUrl,
            position,
          })),
        );
      }
    });
    const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
    await notifyCommunityUsers(
      {
        title: "New Community post",
        message: `${author.displayName} shared a ${data.category.replaceAll("_", " ")} in Community.`,
      },
      { excludeUserId: author.id, targetSuffix: `?post=${id}#community-post-${id}` },
    );
    await notifyMentionedUsers(author, data.message, id);
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
    await notifyMentionedUsers(author, data.message, data.messageId);
    return { id: data.messageId };
  });

export const deleteCommunityMessage = createServerFn({ method: "POST" })
  .validator(postRemovalInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const author = await requireAnyRole(communityRoles);
    const post = await assertCommunityMessageExists(data.messageId);
    const deletingAsManagement = post.authorId !== author.id && author.roles.includes("Management");
    if (post.authorId !== author.id && !deletingAsManagement)
      throw new Error("You can only delete your own Community posts.");

    const { db } = await import("@/db/client.server");
    const {
      communityAttachments,
      communityBookmarks,
      communityCommentReactions,
      communityComments,
      communityMessages,
      communityReactions,
      communityReports,
    } = await import("@/db/schema");
    await db.transaction(async (tx) => {
      const comments = await tx
        .select({ id: communityComments.id })
        .from(communityComments)
        .where(eq(communityComments.messageId, data.messageId));
      if (comments.length) {
        await tx.delete(communityCommentReactions).where(
          inArray(
            communityCommentReactions.commentId,
            comments.map((comment) => comment.id),
          ),
        );
      }
      await tx.delete(communityComments).where(eq(communityComments.messageId, data.messageId));
      await tx.delete(communityReactions).where(eq(communityReactions.messageId, data.messageId));
      await tx
        .delete(communityAttachments)
        .where(eq(communityAttachments.messageId, data.messageId));
      await tx.delete(communityBookmarks).where(eq(communityBookmarks.messageId, data.messageId));
      await tx.delete(communityReports).where(eq(communityReports.messageId, data.messageId));
      await tx.delete(communityMessages).where(eq(communityMessages.id, data.messageId));
    });
    if (deletingAsManagement) {
      const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
      await notifyCommunityUsers(
        {
          title: "Community post removed",
          message: "Management removed one of your Community posts.",
        },
        { userIds: [post.authorId] },
      );
    }
    await writeAuditLog(
      author.id,
      deletingAsManagement ? "community.moderation.delete" : "community.delete",
      "community_message",
      data.messageId,
      deletingAsManagement ? { postAuthorId: post.authorId } : undefined,
    );
    return { id: data.messageId };
  });

export const setCommunityPostPinned = createServerFn({ method: "POST" })
  .validator(postPinInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const moderator = await requireAnyRole(["Management", "Marketer"]);
    const post = await assertCommunityMessageExists(data.messageId);
    const { db } = await import("@/db/client.server");
    const { communityMessages } = await import("@/db/schema");
    const [postDetails] = await db
      .select({ category: communityMessages.category })
      .from(communityMessages)
      .where(eq(communityMessages.id, data.messageId));
    if (!postDetails) throw new Error("This community post is no longer available.");
    if (!canPinCommunityPost(moderator.roles, postDetails.category)) {
      throw new Error("Only Management can pin or unpin posts outside Announcements.");
    }

    await db
      .update(communityMessages)
      .set({
        isPinned: data.pinned,
        pinnedAt: data.pinned ? new Date() : null,
        pinnedById: data.pinned ? moderator.id : null,
        updatedAt: new Date(),
      })
      .where(eq(communityMessages.id, data.messageId));

    if (post.authorId !== moderator.id) {
      const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
      await notifyCommunityUsers(
        {
          title: data.pinned ? "Community post pinned" : "Community post unpinned",
          message: data.pinned
            ? `${moderator.displayName} pinned your Community post.`
            : `${moderator.displayName} unpinned your Community post.`,
        },
        { userIds: [post.authorId] },
      );
    }

    await writeAuditLog(
      moderator.id,
      data.pinned ? "community.pin" : "community.unpin",
      "community_message",
      data.messageId,
      { postAuthorId: post.authorId },
    );
    return { id: data.messageId, pinned: data.pinned };
  });

export const setCommunityPostSaved = createServerFn({ method: "POST" })
  .validator(postBookmarkInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const user = await requireAnyRole(communityRoles);
    await assertCommunityMessageExists(data.messageId);
    const { db } = await import("@/db/client.server");
    const { communityBookmarks } = await import("@/db/schema");
    if (data.saved) {
      await db
        .insert(communityBookmarks)
        .values({ id: crypto.randomUUID(), messageId: data.messageId, userId: user.id })
        .onDuplicateKeyUpdate({ set: { messageId: data.messageId } });
    } else {
      await db
        .delete(communityBookmarks)
        .where(
          and(
            eq(communityBookmarks.messageId, data.messageId),
            eq(communityBookmarks.userId, user.id),
          ),
        );
    }
    await writeAuditLog(
      user.id,
      data.saved ? "community.save" : "community.unsave",
      "community_message",
      data.messageId,
    );
    return { saved: data.saved };
  });

export const reportCommunityPost = createServerFn({ method: "POST" })
  .validator(postReportInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const reporter = await requireAnyRole(communityRoles);
    const post = await assertCommunityMessageExists(data.messageId);
    if (post.authorId === reporter.id) throw new Error("You cannot report your own post.");
    const { db } = await import("@/db/client.server");
    const { communityReports } = await import("@/db/schema");
    await db
      .insert(communityReports)
      .values({
        id: crypto.randomUUID(),
        messageId: data.messageId,
        reporterId: reporter.id,
        reason: data.reason,
      })
      .onDuplicateKeyUpdate({ set: { reason: data.reason, status: "pending" } });
    const { notifyRole } = await import("@/services/messaging/notification-server");
    await notifyRole("Management", {
      title: "Community post reported",
      message: `${reporter.displayName} reported a Community post for review.`,
      target: `/management/community?post=${data.messageId}#community-post-${data.messageId}`,
    });
    await writeAuditLog(reporter.id, "community.report", "community_message", data.messageId, {
      reason: data.reason,
    });
    return { reported: true };
  });

export const setCommunityQuestionStatus = createServerFn({ method: "POST" })
  .validator(postQuestionStatusInput)
  .handler(async ({ data }) => {
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const author = await requireAnyRole(communityRoles);
    const { db } = await import("@/db/client.server");
    const { communityComments, communityMessages } = await import("@/db/schema");
    return db.transaction(async (tx) => {
      // Comments and resolution take the same post lock so a closed question cannot accept a late reply.
      const [post] = await tx
        .select({
          authorId: communityMessages.authorId,
          category: communityMessages.category,
          questionStatus: communityMessages.questionStatus,
          helpfulCommentId: communityMessages.helpfulCommentId,
        })
        .from(communityMessages)
        .where(eq(communityMessages.id, data.messageId))
        .for("update");
      if (!post) throw new Error("This community post is no longer available.");
      assertQuestionStatusChange(author, post, data.status);
      const helpfulCommentId =
        data.helpfulCommentId === undefined ? post.helpfulCommentId : data.helpfulCommentId;
      if (helpfulCommentId) {
        const [comment] = await tx
          .select({ id: communityComments.id })
          .from(communityComments)
          .where(
            and(
              eq(communityComments.id, helpfulCommentId),
              eq(communityComments.messageId, data.messageId),
            ),
          );
        if (!comment)
          throw new Error("The selected helpful answer does not belong to this question.");
      }
      await tx
        .update(communityMessages)
        .set({ questionStatus: data.status, helpfulCommentId, updatedAt: new Date() })
        .where(eq(communityMessages.id, data.messageId));
      await writeAuditLog(
        author.id,
        "community.question.status",
        "community_message",
        data.messageId,
        {
          status: data.status,
          helpfulCommentId,
        },
        tx,
      );
      return { status: data.status, helpfulCommentId };
    });
  });

export const moderateCommunityPost = createServerFn({ method: "POST" })
  .validator(moderationInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const manager = await requireRole("Management");
    const post = await assertCommunityMessageExists(data.messageId);
    const { db } = await import("@/db/client.server");
    const { communityMessages, communityReports } = await import("@/db/schema");
    const hidden = data.action === "hide";
    await db.transaction(async (tx) => {
      if (data.action !== "dismiss") {
        await tx
          .update(communityMessages)
          .set({
            moderationStatus: hidden ? "hidden" : "visible",
            moderationReason: hidden ? data.reason || "Hidden after Management review" : null,
            moderatedAt: new Date(),
            moderatedById: manager.id,
            updatedAt: new Date(),
          })
          .where(eq(communityMessages.id, data.messageId));
      }
      await tx
        .update(communityReports)
        .set({
          status: data.action === "dismiss" ? "dismissed" : "reviewed",
          reviewedAt: new Date(),
          reviewedById: manager.id,
        })
        .where(eq(communityReports.messageId, data.messageId));
    });
    if (post.authorId !== manager.id && data.action !== "dismiss") {
      const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
      await notifyCommunityUsers(
        {
          title: hidden ? "Community post hidden" : "Community post restored",
          message: hidden
            ? "Management hid your Community post after moderation review."
            : "Management restored your Community post.",
        },
        { userIds: [post.authorId] },
      );
    }
    await writeAuditLog(
      manager.id,
      `community.moderation.${data.action}`,
      "community_message",
      data.messageId,
      { reason: data.reason, postAuthorId: post.authorId },
    );
    return { action: data.action };
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
    await writeAuditLog(
      user.id,
      "community.comment_reaction.remove",
      "community_comment",
      data.commentId,
    );
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
    const { communityCommentReactions, communityComments, communityMessages } =
      await import("@/db/schema");
    await db.transaction(async (tx) => {
      await tx
        .select({ id: communityMessages.id })
        .from(communityMessages)
        .where(eq(communityMessages.id, comment.messageId))
        .for("update");
      await tx
        .delete(communityCommentReactions)
        .where(eq(communityCommentReactions.commentId, data.commentId));
      await tx
        .delete(communityComments)
        .where(
          and(eq(communityComments.id, data.commentId), eq(communityComments.authorId, author.id)),
        );
      await tx
        .update(communityMessages)
        .set({
          helpfulCommentId: null,
          questionStatus: sql`CASE WHEN ${communityMessages.questionStatus} = 'resolved' THEN 'resolved' ELSE 'open' END`,
          updatedAt: new Date(),
        })
        .where(eq(communityMessages.helpfulCommentId, data.commentId));
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
    const { communityComments, communityMessages } = await import("@/db/schema");
    const recentComments = await db
      .select({ message: communityComments.message, createdAt: communityComments.createdAt })
      .from(communityComments)
      .where(
        and(
          eq(communityComments.authorId, author.id),
          gte(communityComments.createdAt, new Date(Date.now() - 10 * 60 * 1_000)),
        ),
      )
      .orderBy(desc(communityComments.createdAt))
      .limit(15);
    if (recentComments[0] && Date.now() - recentComments[0].createdAt.getTime() < 10_000) {
      throw new Error("Please wait a few seconds before adding another comment.");
    }
    if (
      recentComments.some(
        (comment) => normalizedMessage(comment.message) === normalizedMessage(data.message),
      )
    ) {
      throw new Error("You recently posted the same comment.");
    }
    const id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      const [currentPost] = await tx
        .select({
          category: communityMessages.category,
          questionStatus: communityMessages.questionStatus,
        })
        .from(communityMessages)
        .where(eq(communityMessages.id, data.messageId))
        .for("update");
      if (!currentPost) throw new Error("This community post is no longer available.");
      if (communityCommentsClosed(currentPost)) {
        throw new Error("This question is resolved. Comments and replies are closed.");
      }
      await tx.insert(communityComments).values({
        id,
        messageId: data.messageId,
        parentCommentId: parent?.id ?? null,
        authorId: author.id,
        message: data.message,
      });
    });
    if (parent && parent.authorId !== author.id) {
      const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
      await notifyCommunityUsers(
        {
          title: "New reply to your comment",
          message: `${author.displayName} replied to your Community comment.`,
        },
        {
          userIds: [parent.authorId],
          targetSuffix: `?post=${data.messageId}&comment=${id}#community-comment-${id}`,
        },
      );
    } else if (!parent && post.authorId !== author.id) {
      const { notifyCommunityUsers } = await import("@/services/messaging/notification-server");
      await notifyCommunityUsers(
        {
          title: "New comment on your post",
          message: `${author.displayName} commented on your Community post.`,
        },
        {
          userIds: [post.authorId],
          targetSuffix: `?post=${data.messageId}&comment=${id}#community-comment-${id}`,
        },
      );
    }
    await notifyMentionedUsers(author, data.message, data.messageId, id);
    await writeAuditLog(author.id, "community.comment", "community_message", data.messageId, {
      commentId: id,
      parentCommentId: parent?.id ?? null,
    });
    return { id };
  });
