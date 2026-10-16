import {
  LoaderCircle,
  MessageCircle,
  Pencil,
  Radio,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  getCommunityMessages,
  getMyCommunityMessages,
  deleteCommunityMessage,
  postCommunityComment,
  postCommunityMessage,
  removeCommunityReaction,
  setCommunityReaction,
  updateCommunityMessage,
} from "@/services/messaging/community-server-functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CommunityFeedProps = {
  title: string;
  placeholder?: string;
  scope?: "all" | "mine";
  showComposer?: boolean;
};

export function CommunityFeed({
  title,
  placeholder = "Share an update...",
  scope = "all",
  showComposer = true,
}: CommunityFeedProps) {
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof getCommunityMessages>>>([]);
  const [postMessage, setPostMessage] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [busyPost, setBusyPost] = useState(false);
  const [busyReactionId, setBusyReactionId] = useState<string | null>(null);
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyEditId, setBusyEditId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const refreshing = useRef(false);

  useEffect(() => {
    const debounce = window.setTimeout(() => setSearchQuery(search.trim()), 250);
    return () => window.clearTimeout(debounce);
  }, [search]);

  const load = useCallback(
    async ({ showError = false }: { showError?: boolean } = {}) => {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        setMessages(
          await (scope === "mine"
            ? getMyCommunityMessages({ data: { query: searchQuery } })
            : getCommunityMessages({ data: { query: searchQuery } })),
        );
      } catch {
        if (showError) toast.error("Could not load community posts. Please try again.");
      } finally {
        refreshing.current = false;
      }
    },
    [scope, searchQuery],
  );

  useEffect(() => {
    void load({ showError: true });
    const polling = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 4_000);
    const refreshOnFocus = () => void load();
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => {
      window.clearInterval(polling);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [load]);

  return (
    <>
      <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          <Radio className="size-3.5" aria-hidden="true" />
          Live updates are on. New posts, comments, and reactions appear automatically.
        </p>
        {scope === "all" && (
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Community by post or author"
              aria-label="Search Community posts"
              className="pl-9"
              maxLength={120}
            />
          </div>
        )}
        {showComposer && (
          <form
            className="mt-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const message = postMessage.trim();
              if (!message) return;
              setBusyPost(true);
              try {
                await postCommunityMessage({ data: { message } });
                setPostMessage("");
                await load();
                toast.success("Your post is now visible in Community.");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Could not post community message.",
                );
              } finally {
                setBusyPost(false);
              }
            }}
          >
            <Textarea
              name="message"
              value={postMessage}
              onChange={(event) => setPostMessage(event.target.value)}
              placeholder={placeholder}
              maxLength={4_000}
              required
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{postMessage.length}/4000 characters</p>
              <Button type="submit" className="rounded-full" disabled={busyPost}>
                {busyPost ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Post update
              </Button>
            </div>
          </form>
        )}
      </section>
      <section className="mt-6 space-y-4" aria-live="polite">
        {messages.map((message) => {
          const commentsOpen = expandedComments[message.id] ?? false;
          const commentDraft = commentDrafts[message.id] ?? "";
          const reactionBusy = busyReactionId === message.id;
          const commentBusy = busyCommentId === message.id;
          const editing = editingPostId === message.id;
          const editingBusy = busyEditId === message.id;
          const deleting = busyDeleteId === message.id;
          return (
            <article
              key={message.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-semibold">{message.author}</p>
                  <p className="text-xs text-primary">{message.role}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(message.time).toLocaleString("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
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
                    <Button type="submit" size="sm" className="rounded-full" disabled={editingBusy}>
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
              {message.isOwner && !editing && (
                <div className="mt-3 flex flex-wrap gap-2">
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-destructive hover:text-destructive"
                    disabled={deleting}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Delete this Community post and all of its comments and reactions?",
                        )
                      )
                        return;
                      setBusyDeleteId(message.id);
                      try {
                        await deleteCommunityMessage({ data: { messageId: message.id } });
                        await load();
                        toast.success("Community post deleted.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not delete your Community post.",
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
                        error instanceof Error ? error.message : "Could not update your reaction.",
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
                        error instanceof Error ? error.message : "Could not update your reaction.",
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
                  {message.comments.length} {message.comments.length === 1 ? "comment" : "comments"}
                </Button>
              </div>
              {commentsOpen && (
                <div className="mt-4 space-y-4">
                  {message.comments.length > 0 && (
                    <div className="space-y-3">
                      {message.comments.map((comment) => (
                        <div key={comment.id} className="rounded-2xl bg-muted/60 px-4 py-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold">{comment.author}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(comment.time).toLocaleString("en-PH", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </p>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {comment.message}
                          </p>
                        </div>
                      ))}
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
                          data: { messageId: message.id, message: comment },
                        });
                        setCommentDrafts((current) => ({ ...current, [message.id]: "" }));
                        await load();
                        toast.success("Comment added.");
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
                      value={commentDraft}
                      onChange={(event) =>
                        setCommentDrafts((current) => ({
                          ...current,
                          [message.id]: event.target.value,
                        }))
                      }
                      placeholder="Write a comment..."
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
                      Comment
                    </Button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
        {messages.length === 0 && (
          <p className="rounded-3xl border border-dashed p-6 text-sm text-muted-foreground">
            {scope === "mine"
              ? "You have not posted in Community yet."
              : "No community messages have been posted yet."}
          </p>
        )}
      </section>
    </>
  );
}
