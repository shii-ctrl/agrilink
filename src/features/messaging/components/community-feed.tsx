import {
  LoaderCircle,
  MessageCircle,
  Pencil,
  Pin,
  PinOff,
  Radio,
  RefreshCw,
  Reply,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  getCommunityMessages,
  getMyCommunityMessages,
  deleteCommunityComment,
  deleteCommunityMessage,
  postCommunityComment,
  postCommunityMessage,
  removeCommunityCommentReaction,
  removeCommunityReaction,
  setCommunityCommentReaction,
  setCommunityPostPinned,
  setCommunityReaction,
  updateCommunityMessage,
} from "@/services/messaging/community-server-functions";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/app-select";
import {
  communityPostCategoryLabels,
  communityPostCategoryOptions,
  type CommunityPostCategory,
} from "@/features/messaging/community-categories";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CommunityFeedProps = {
  title: string;
  placeholder?: string;
  scope?: "all" | "mine";
  showComposer?: boolean;
};

const COMMUNITY_PAGE_SIZE = 25;
const categoryBadgeTone: Record<CommunityPostCategory, string> = {
  announcement: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  question: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  farming_tip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  marketplace_update: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  general_discussion: "border-border bg-muted text-muted-foreground",
};
type CommunityPost = Awaited<ReturnType<typeof getCommunityMessages>>["messages"][number];
type CommunityComment = CommunityPost["comments"][number];

type CommunityCommentCardProps = {
  comment: CommunityComment;
  busy: boolean;
  replyCount?: number;
  repliesOpen?: boolean;
  onReaction: (comment: CommunityComment, reaction: "like" | "dislike") => void;
  onDelete?: (() => void) | undefined;
  onReply?: (() => void) | undefined;
  onToggleReplies?: (() => void) | undefined;
  children?: ReactNode;
};

function CommunityAvatar({
  name,
  avatarUrl,
  className = "size-10",
}: {
  name: string;
  avatarUrl: string | null;
  className?: string;
}) {
  return <ProfileAvatar name={name} avatarUrl={avatarUrl} className={className} />;
}

function CommunityCommentCard({
  comment,
  busy,
  replyCount = 0,
  repliesOpen = false,
  onReaction,
  onDelete,
  onReply,
  onToggleReplies,
  children,
}: CommunityCommentCardProps) {
  return (
    <div className="rounded-2xl bg-muted/60 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CommunityAvatar
            name={comment.author}
            avatarUrl={comment.authorAvatarUrl}
            className="size-8"
          />
          <p className="truncate text-sm font-semibold">{comment.author}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(comment.time).toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{comment.message}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant={comment.reactions.viewerReaction === "like" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 rounded-full px-2 text-xs"
          disabled={busy}
          aria-label={`Like ${comment.author}'s comment`}
          aria-pressed={comment.reactions.viewerReaction === "like"}
          onClick={() => onReaction(comment, "like")}
        >
          <ThumbsUp className="size-3.5" /> Like {comment.reactions.likes || ""}
        </Button>
        <Button
          type="button"
          variant={comment.reactions.viewerReaction === "dislike" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 rounded-full px-2 text-xs"
          disabled={busy}
          aria-label={`Dislike ${comment.author}'s comment`}
          aria-pressed={comment.reactions.viewerReaction === "dislike"}
          onClick={() => onReaction(comment, "dislike")}
        >
          <ThumbsDown className="size-3.5" /> Dislike {comment.reactions.dislikes || ""}
        </Button>
        {onReply && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 rounded-full p-0"
            aria-label={`Reply to ${comment.author}`}
            title={`Reply to ${comment.author}`}
            onClick={onReply}
          >
            <Reply className="size-4" />
            <span className="sr-only">Reply to {comment.author}</span>
          </Button>
        )}
        {onToggleReplies && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-2 text-xs"
            aria-expanded={repliesOpen}
            onClick={onToggleReplies}
          >
            <MessageCircle className="size-3.5" />
            {repliesOpen ? "Hide" : "Show"} {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 rounded-full p-0 text-destructive hover:text-destructive"
            disabled={busy}
            aria-label="Delete your comment"
            title="Delete your comment"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Delete your comment</span>
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

export function CommunityFeed({
  title,
  placeholder = "Share an update...",
  scope = "all",
  showComposer = true,
}: CommunityFeedProps) {
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const [messages, setMessages] = useState<CommunityPost[]>([]);
  const [postMessage, setPostMessage] = useState("");
  const [postCategory, setPostCategory] = useState<CommunityPostCategory>("general_discussion");
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyTargets, setReplyTargets] = useState<Record<string, string | null>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [busyPost, setBusyPost] = useState(false);
  const [busyReactionId, setBusyReactionId] = useState<string | null>(null);
  const [busyCommentReactionId, setBusyCommentReactionId] = useState<string | null>(null);
  const [busyCommentDeleteId, setBusyCommentDeleteId] = useState<string | null>(null);
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyEditId, setBusyEditId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [busyPinId, setBusyPinId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshing = useRef(false);
  const messagesRef = useRef<CommunityPost[]>([]);
  const nextOffsetRef = useRef<number | null>(null);
  const hasMoreRef = useRef(false);
  const commentInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    const debounce = window.setTimeout(() => setSearchQuery(search.trim()), 250);
    return () => window.clearTimeout(debounce);
  }, [search]);

  const load = useCallback(
    async ({
      append = false,
      preservePages = false,
      silent = false,
    }: { append?: boolean; preservePages?: boolean; silent?: boolean } = {}) => {
      if (refreshing.current) return;
      refreshing.current = true;
      if (append) setLoadingMore(true);
      else if (!silent) setLoading(true);
      try {
        const data = {
          query: searchQuery,
          offset: append ? (nextOffsetRef.current ?? messagesRef.current.length) : 0,
          pageSize: COMMUNITY_PAGE_SIZE,
        };
        const result = await (scope === "mine"
          ? getMyCommunityMessages({ data })
          : getCommunityMessages({ data }));
        const nextMessages = append
          ? [
              ...messagesRef.current,
              ...result.messages.filter(
                (message) => !messagesRef.current.some((item) => item.id === message.id),
              ),
            ]
          : preservePages && messagesRef.current.length > COMMUNITY_PAGE_SIZE
            ? [
                ...result.messages,
                ...messagesRef.current.filter(
                  (message) => !result.messages.some((item) => item.id === message.id),
                ),
              ]
            : result.messages;
        messagesRef.current = nextMessages;
        const nextHasMore = preservePages ? hasMoreRef.current : result.hasMore;
        nextOffsetRef.current = preservePages
          ? nextHasMore
            ? nextMessages.length
            : null
          : result.nextOffset;
        hasMoreRef.current = nextHasMore;
        setMessages(nextMessages);
        setHasMore(nextHasMore);
        setNextOffset(nextOffsetRef.current);
        setLoadError(null);
      } catch (error) {
        if (!silent) {
          setLoadError(error instanceof Error ? error.message : "Please try again.");
        }
      } finally {
        if (append) setLoadingMore(false);
        else if (!silent) setLoading(false);
        refreshing.current = false;
      }
    },
    [scope, searchQuery],
  );

  useEffect(() => {
    void load();
    const polling = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load({ preservePages: true, silent: true });
      }
    }, 4_000);
    const refreshOnFocus = () => void load({ preservePages: true, silent: true });
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") {
        void load({ preservePages: true, silent: true });
      }
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => {
      window.clearInterval(polling);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [load]);

  const reactToComment = async (comment: CommunityComment, reaction: "like" | "dislike") => {
    setBusyCommentReactionId(comment.id);
    try {
      if (comment.reactions.viewerReaction === reaction) {
        await removeCommunityCommentReaction({ data: { commentId: comment.id } });
      } else {
        await setCommunityCommentReaction({ data: { commentId: comment.id, reaction } });
      }
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update this comment reaction.",
      );
    } finally {
      setBusyCommentReactionId(null);
    }
  };

  const deleteComment = async (comment: CommunityComment) => {
    if (
      !(await requestConfirmation({
        title: "Delete your comment?",
        description:
          "This permanently removes your comment. Replies from other people will stay visible as comments.",
        confirmLabel: "Delete comment",
        destructive: true,
      }))
    )
      return;
    setBusyCommentDeleteId(comment.id);
    try {
      await deleteCommunityComment({ data: { commentId: comment.id } });
      await load();
      toast.success("Your comment was deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete your comment.");
    } finally {
      setBusyCommentDeleteId(null);
    }
  };

  const submitCommunityPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = postMessage.trim();
    if (!message) return;
    setBusyPost(true);
    try {
      await postCommunityMessage({ data: { category: postCategory, message } });
      setPostMessage("");
      setPostCategory("general_discussion");
      setComposerOpen(false);
      await load();
      toast.success("Your post is now visible in Community.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post community message.");
    } finally {
      setBusyPost(false);
    }
  };

  return (
    <>
      {confirmationDialog}
      {showComposer && (
        <Dialog
          open={composerOpen}
          onOpenChange={(open) => {
            if (!busyPost) setComposerOpen(open);
          }}
        >
          <DialogContent className="max-h-[calc(100dvh_-_1rem)] overflow-y-auto rounded-3xl border-primary/20 p-0 shadow-field sm:max-w-2xl">
            <form onSubmit={submitCommunityPost}>
              <DialogHeader className="border-b border-border px-5 pb-4 pt-5 text-left sm:px-6 sm:pt-6">
                <DialogTitle className="flex items-center gap-2 pr-10 text-xl">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageCircle className="size-5" />
                  </span>
                  Share your thoughts
                </DialogTitle>
                <DialogDescription>
                  {title}. Your update will be visible to AgriLink Community members.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 px-5 py-5 sm:px-6">
                <div className="space-y-2">
                  <label htmlFor="community-post-category" className="text-sm font-semibold">
                    Post category
                  </label>
                  <AppSelect
                    id="community-post-category"
                    name="category"
                    value={postCategory}
                    onValueChange={(value) => setPostCategory(value as CommunityPostCategory)}
                    options={communityPostCategoryOptions}
                    ariaLabel="Choose a Community post category"
                    searchable={false}
                    disabled={busyPost}
                    className="min-h-12"
                  />
                </div>
                <label htmlFor="community-post-message" className="text-sm font-semibold">
                  Community update
                </label>
                <Textarea
                  id="community-post-message"
                  name="message"
                  value={postMessage}
                  onChange={(event) => setPostMessage(event.target.value)}
                  placeholder={placeholder}
                  className="min-h-40 resize-y"
                  maxLength={4_000}
                  autoFocus
                  required
                />
                <p className="text-right text-xs text-muted-foreground">
                  {postMessage.length}/4000 characters
                </p>
              </div>

              <DialogFooter className="border-t border-border px-5 py-4 sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full sm:w-auto"
                  disabled={busyPost}
                  onClick={() => setComposerOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="w-full rounded-full sm:w-auto"
                  disabled={busyPost || !postMessage.trim()}
                >
                  {busyPost ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {busyPost ? "Posting…" : "Post to Community"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10">
                <MessageCircle className="size-4.5 text-primary" />
              </span>
              <h2 className="truncate text-base font-semibold sm:text-lg">{title}</h2>
            </div>
            <p className="mt-2 flex items-start gap-1.5 pl-0 text-xs font-medium leading-5 text-primary sm:pl-11">
              <Radio className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>Live updates are on. New posts, comments, and reactions appear automatically.</span>
            </p>
          </div>
          {showComposer && (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-auto shrink-0 rounded-full border-primary/20 bg-background px-3 text-foreground shadow-sm hover:border-primary/35 hover:bg-primary/5 sm:px-4"
              onClick={() => setComposerOpen(true)}
            >
              <Pencil className="size-4 text-primary" />
              <span className="hidden font-medium sm:inline">Share your thoughts</span>
              <span className="font-medium sm:hidden">Post</span>
            </Button>
          )}
        </div>
        {scope === "all" && (
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Community by post or author"
              aria-label="Search Community posts"
              className="h-11 rounded-2xl bg-background pl-10"
              maxLength={120}
            />
          </div>
        )}
      </section>
      <section className="mt-6 space-y-4" aria-live="polite">
        {loading && (
          <p className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
            Loading Community posts…
          </p>
        )}
        {loadError && !loading && (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center shadow-card">
            <p className="font-semibold">Could not load Community posts</p>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 rounded-full"
              onClick={() => void load()}
            >
              <RefreshCw className="size-4" /> Try again
            </Button>
          </div>
        )}
        {!loading &&
          !loadError &&
          messages.map((message) => {
            const commentsOpen = expandedComments[message.id] ?? false;
            const commentDraft = commentDrafts[message.id] ?? "";
            const replyTargetId = replyTargets[message.id] ?? null;
            const replyTarget = message.comments.find((comment) => comment.id === replyTargetId);
            const rootComments = message.comments.filter((comment) => !comment.parentCommentId);
            const reactionBusy = busyReactionId === message.id;
            const commentBusy = busyCommentId === message.id;
            const editing = editingPostId === message.id;
            const editingBusy = busyEditId === message.id;
            const deleting = busyDeleteId === message.id;
            const pinning = busyPinId === message.id;
            return (
              <article
                key={message.id}
                className={`rounded-3xl border bg-card p-5 shadow-card ${
                  message.isPinned ? "border-primary/40 ring-1 ring-primary/10" : "border-border"
                }`}
              >
                {message.isPinned && (
                  <div className="mb-4 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                    <Pin className="size-4 fill-current" /> Pinned official announcement
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <CommunityAvatar name={message.author} avatarUrl={message.authorAvatarUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{message.author}</p>
                      <p className="text-xs text-primary">{message.role}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(message.time).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${categoryBadgeTone[message.category]}`}
                >
                  {communityPostCategoryLabels[message.category]}
                </span>
                {editing ? (
                  <form
                    className="mt-4 space-y-3"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const nextMessage = editDraft.trim();
                      if (!nextMessage) return;
                      setBusyEditId(message.id);
                      try {
                        await updateCommunityMessage({
                          data: { messageId: message.id, message: nextMessage },
                        });
                        setEditingPostId(null);
                        setEditDraft("");
                        await load();
                        toast.success("Community post updated.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not update your Community post.",
                        );
                      } finally {
                        setBusyEditId(null);
                      }
                    }}
                  >
                    <Textarea
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      maxLength={4_000}
                      rows={4}
                      required
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="rounded-full"
                        disabled={editingBusy}
                      >
                        {editingBusy ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Pencil className="size-4" />
                        )}
                        Save changes
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        disabled={editingBusy}
                        onClick={() => {
                          setEditingPostId(null);
                          setEditDraft("");
                        }}
                      >
                        <X className="size-4" /> Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {message.message}
                  </p>
                )}
                {(message.isOwner || message.canDelete || message.canPin) && !editing && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.isOwner && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        disabled={deleting}
                        onClick={() => {
                          setEditingPostId(message.id);
                          setEditDraft(message.message);
                        }}
                      >
                        <Pencil className="size-4" /> Edit post
                      </Button>
                    )}
                    {message.canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-destructive hover:text-destructive"
                        disabled={deleting}
                        onClick={async () => {
                          if (
                            !(await requestConfirmation({
                              title: message.isOwner
                                ? "Delete this post?"
                                : "Remove this Community post?",
                              description: message.isOwner
                                ? "This permanently removes the post, its comments, and its reactions."
                                : "Management moderation will permanently remove this post, its comments, and its reactions. This action is recorded in the audit log.",
                              confirmLabel: "Delete post",
                              destructive: true,
                            }))
                          )
                            return;
                          setBusyDeleteId(message.id);
                          try {
                            await deleteCommunityMessage({ data: { messageId: message.id } });
                            await load();
                            toast.success(
                              message.isOwner
                                ? "Community post deleted."
                                : "Community post removed by Management.",
                            );
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Could not delete this Community post.",
                            );
                          } finally {
                            setBusyDeleteId(null);
                          }
                        }}
                      >
                        {deleting ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                        Delete post
                      </Button>
                    )}
                    {message.canPin &&
                      (message.category === "announcement" || message.isPinned) && (
                        <Button
                          type="button"
                          variant={message.isPinned ? "secondary" : "ghost"}
                          size="sm"
                          className="rounded-full"
                          disabled={pinning || deleting}
                          onClick={async () => {
                            setBusyPinId(message.id);
                            try {
                              await setCommunityPostPinned({
                                data: { messageId: message.id, pinned: !message.isPinned },
                              });
                              await load();
                              toast.success(
                                message.isPinned
                                  ? "Official announcement unpinned."
                                  : "Announcement pinned to the top of Community.",
                              );
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Could not update this pinned announcement.",
                              );
                            } finally {
                              setBusyPinId(null);
                            }
                          }}
                        >
                          {pinning ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : message.isPinned ? (
                            <PinOff className="size-4" />
                          ) : (
                            <Pin className="size-4" />
                          )}
                          {message.isPinned ? "Unpin announcement" : "Pin announcement"}
                        </Button>
                      )}
                  </div>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-border/70 py-2">
                  <Button
                    type="button"
                    variant={message.reactions.viewerReaction === "like" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-full"
                    disabled={reactionBusy}
                    aria-pressed={message.reactions.viewerReaction === "like"}
                    onClick={async () => {
                      setBusyReactionId(message.id);
                      try {
                        if (message.reactions.viewerReaction === "like") {
                          await removeCommunityReaction({ data: { messageId: message.id } });
                        } else {
                          await setCommunityReaction({
                            data: { messageId: message.id, reaction: "like" },
                          });
                        }
                        await load();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not update your reaction.",
                        );
                      } finally {
                        setBusyReactionId(null);
                      }
                    }}
                  >
                    <ThumbsUp className="size-4" /> Like {message.reactions.likes || ""}
                  </Button>
                  <Button
                    type="button"
                    variant={message.reactions.viewerReaction === "dislike" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-full"
                    disabled={reactionBusy}
                    aria-pressed={message.reactions.viewerReaction === "dislike"}
                    onClick={async () => {
                      setBusyReactionId(message.id);
                      try {
                        if (message.reactions.viewerReaction === "dislike") {
                          await removeCommunityReaction({ data: { messageId: message.id } });
                        } else {
                          await setCommunityReaction({
                            data: { messageId: message.id, reaction: "dislike" },
                          });
                        }
                        await load();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not update your reaction.",
                        );
                      } finally {
                        setBusyReactionId(null);
                      }
                    }}
                  >
                    <ThumbsDown className="size-4" /> Dislike {message.reactions.dislikes || ""}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    aria-expanded={commentsOpen}
                    onClick={() =>
                      setExpandedComments((current) => ({
                        ...current,
                        [message.id]: !commentsOpen,
                      }))
                    }
                  >
                    <MessageCircle className="size-4" />
                    {message.comments.length}{" "}
                    {message.comments.length === 1 ? "comment" : "comments"}
                  </Button>
                </div>
                {commentsOpen && (
                  <div className="mt-4 space-y-4">
                    {message.comments.length > 0 && (
                      <div className="space-y-3">
                        {rootComments.map((comment) => {
                          const replies = message.comments.filter(
                            (reply) => reply.parentCommentId === comment.id,
                          );
                          const repliesOpen = expandedReplies[comment.id] ?? false;
                          return (
                            <CommunityCommentCard
                              key={comment.id}
                              comment={comment}
                              busy={
                                busyCommentReactionId === comment.id ||
                                busyCommentDeleteId === comment.id
                              }
                              replyCount={replies.length}
                              repliesOpen={repliesOpen}
                              onReaction={reactToComment}
                              onDelete={
                                comment.isOwner ? () => void deleteComment(comment) : undefined
                              }
                              onReply={() => {
                                setReplyTargets((current) => ({
                                  ...current,
                                  [message.id]: comment.id,
                                }));
                                setExpandedReplies((current) => ({
                                  ...current,
                                  [comment.id]: true,
                                }));
                                window.setTimeout(() =>
                                  commentInputRefs.current[message.id]?.focus(),
                                );
                              }}
                              onToggleReplies={
                                replies.length > 0
                                  ? () =>
                                      setExpandedReplies((current) => ({
                                        ...current,
                                        [comment.id]: !repliesOpen,
                                      }))
                                  : undefined
                              }
                            >
                              {repliesOpen && replies.length > 0 && (
                                <div className="mt-3 ml-4 space-y-3 border-l-2 border-primary/30 pl-3 sm:ml-6">
                                  {replies.map((reply) => (
                                    <CommunityCommentCard
                                      key={reply.id}
                                      comment={reply}
                                      busy={
                                        busyCommentReactionId === reply.id ||
                                        busyCommentDeleteId === reply.id
                                      }
                                      onReaction={reactToComment}
                                      onDelete={
                                        reply.isOwner ? () => void deleteComment(reply) : undefined
                                      }
                                    />
                                  ))}
                                </div>
                              )}
                            </CommunityCommentCard>
                          );
                        })}
                      </div>
                    )}
                    {replyTarget && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm">
                        <p>
                          Replying to <span className="font-semibold">{replyTarget.author}</span>
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-full px-2"
                          onClick={() =>
                            setReplyTargets((current) => ({ ...current, [message.id]: null }))
                          }
                        >
                          <X className="size-4" /> Cancel reply
                        </Button>
                      </div>
                    )}
                    <form
                      className="flex flex-col gap-2 sm:flex-row"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const comment = commentDraft.trim();
                        if (!comment) return;
                        setBusyCommentId(message.id);
                        try {
                          await postCommunityComment({
                            data: {
                              messageId: message.id,
                              parentCommentId: replyTarget?.id,
                              message: comment,
                            },
                          });
                          setCommentDrafts((current) => ({ ...current, [message.id]: "" }));
                          setReplyTargets((current) => ({ ...current, [message.id]: null }));
                          if (replyTarget) {
                            setExpandedReplies((current) => ({
                              ...current,
                              [replyTarget.id]: true,
                            }));
                          }
                          await load();
                          toast.success(replyTarget ? "Reply added." : "Comment added.");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Could not add your comment.",
                          );
                        } finally {
                          setBusyCommentId(null);
                        }
                      }}
                    >
                      <Textarea
                        ref={(element) => {
                          commentInputRefs.current[message.id] = element;
                        }}
                        value={commentDraft}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [message.id]: event.target.value,
                          }))
                        }
                        placeholder={
                          replyTarget ? `Reply to ${replyTarget.author}...` : "Write a comment..."
                        }
                        maxLength={2_000}
                        rows={2}
                        required
                      />
                      <Button
                        type="submit"
                        className="rounded-full sm:self-end"
                        disabled={commentBusy}
                      >
                        {commentBusy ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        {replyTarget ? "Reply" : "Comment"}
                      </Button>
                    </form>
                  </div>
                )}
              </article>
            );
          })}
        {!loading && !loadError && messages.length === 0 && (
          <p className="rounded-3xl border border-dashed p-6 text-sm text-muted-foreground">
            {scope === "mine"
              ? "You have not posted in Community yet."
              : "No community messages have been posted yet."}
          </p>
        )}
        {!loading && !loadError && hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={loadingMore}
              onClick={() => void load({ append: true })}
            >
              {loadingMore ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Load more posts
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
