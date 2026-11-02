import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
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
  getSavedCommunityMessages,
  deleteCommunityComment,
  deleteCommunityMessage,
  postCommunityComment,
  postCommunityMessage,
  moderateCommunityPost,
  reportCommunityPost,
  removeCommunityCommentReaction,
  removeCommunityReaction,
  setCommunityCommentReaction,
  setCommunityPostPinned,
  setCommunityPostSaved,
  setCommunityQuestionStatus,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CommunityFeedProps = {
  title: string;
  placeholder?: string;
  scope?: "all" | "mine" | "saved";
  showComposer?: boolean;
};

const COMMUNITY_PAGE_SIZE = 25;
type CommunitySort = "latest" | "discussed" | "liked" | "unanswered";
const communitySortOptions = [
  { value: "latest", label: "Latest" },
  { value: "discussed", label: "Most discussed" },
  { value: "liked", label: "Most liked" },
  { value: "unanswered", label: "Unanswered questions" },
];

async function compressCommunityImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Each image must be smaller than 10 MB.");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be opened."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("The image could not be opened."));
    element.src = source;
  });
  const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  let quality = 0.82;
  let result = canvas.toDataURL("image/webp", quality);
  while (result.length > 450_000 && quality > 0.45) {
    quality -= 0.08;
    result = canvas.toDataURL("image/webp", quality);
  }
  if (result.length > 500_000)
    throw new Error("This image is too detailed. Choose a smaller image.");
  return result;
}
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
  isHelpful?: boolean;
  onHelpful?: (() => void) | undefined;
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
  isHelpful = false,
  onHelpful,
  children,
}: CommunityCommentCardProps) {
  return (
    <div
      id={`community-comment-${comment.id}`}
      className={`rounded-2xl px-4 py-3 ${isHelpful ? "border border-emerald-500/30 bg-emerald-500/10" : "bg-muted/60"}`}
    >
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
      {isHelpful && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-3.5" /> Helpful answer
        </p>
      )}
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
        {onHelpful && (
          <Button
            type="button"
            variant={isHelpful ? "secondary" : "ghost"}
            size="sm"
            className="h-8 rounded-full px-2 text-xs"
            disabled={busy}
            onClick={onHelpful}
          >
            <CheckCircle2 className="size-3.5" /> {isHelpful ? "Helpful" : "Mark helpful"}
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
  const [postImages, setPostImages] = useState<string[]>([]);
  const [processingImages, setProcessingImages] = useState(false);
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
  const [busyMenuId, setBusyMenuId] = useState<string | null>(null);
  const [reportingPost, setReportingPost] = useState<CommunityPost | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<CommunitySort>("latest");
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
          sort,
        };
        const result = await (scope === "mine"
          ? getMyCommunityMessages({ data })
          : scope === "saved"
            ? getSavedCommunityMessages({ data })
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
    [scope, searchQuery, sort],
  );

  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId || loading) return;
    window.setTimeout(() => {
      document.getElementById(`community-post-${postId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  }, [loading, messages]);

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
      await postCommunityMessage({
        data: { category: postCategory, message, attachments: postImages },
      });
      setPostMessage("");
      setPostCategory("general_discussion");
      setPostImages([]);
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
                {postImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {postImages.map((imageUrl, index) => (
                      <div key={`${imageUrl.slice(-20)}-${index}`} className="group relative">
                        <img
                          src={imageUrl}
                          alt={`Attachment preview ${index + 1}`}
                          className="aspect-square w-full rounded-2xl border object-cover"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute right-1.5 top-1.5 size-8 rounded-full"
                          aria-label={`Remove attachment ${index + 1}`}
                          onClick={() =>
                            setPostImages((current) => current.filter((_, item) => item !== index))
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-semibold">Photo attachments</p>
                    <p className="text-xs text-muted-foreground">
                      Up to 4 images. Photos are compressed before posting.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted">
                    {processingImages ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <ImagePlus className="size-4 text-primary" />
                    )}
                    Add photos
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      disabled={processingImages || busyPost || postImages.length >= 4}
                      onChange={async (event) => {
                        const files = Array.from(event.target.files ?? []).slice(
                          0,
                          4 - postImages.length,
                        );
                        event.target.value = "";
                        if (!files.length) return;
                        setProcessingImages(true);
                        try {
                          const compressed = await Promise.all(files.map(compressCommunityImage));
                          setPostImages((current) => [...current, ...compressed].slice(0, 4));
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Could not prepare the image.",
                          );
                        } finally {
                          setProcessingImages(false);
                        }
                      }}
                    />
                  </label>
                </div>
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
                  disabled={busyPost || processingImages || !postMessage.trim()}
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
      <Dialog
        open={Boolean(reportingPost)}
        onOpenChange={(open) => {
          if (!open && !busyMenuId) {
            setReportingPost(null);
            setReportReason("");
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report Community post</DialogTitle>
            <DialogDescription>
              Tell Management why this post may be inappropriate, spam, or misleading.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
            placeholder="Describe the concern..."
            maxLength={500}
            rows={4}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReportingPost(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!reportingPost || reportReason.trim().length < 5 || Boolean(busyMenuId)}
              onClick={async () => {
                if (!reportingPost) return;
                setBusyMenuId(reportingPost.id);
                try {
                  await reportCommunityPost({
                    data: { messageId: reportingPost.id, reason: reportReason.trim() },
                  });
                  setReportingPost(null);
                  setReportReason("");
                  await load();
                  toast.success("Report sent to Management for review.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not send report.");
                } finally {
                  setBusyMenuId(null);
                }
              }}
            >
              <Flag className="size-4" /> Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
              <span>
                Live updates are on. New posts, comments, and reactions appear automatically.
              </span>
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
        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
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
          <AppSelect
            value={sort}
            onValueChange={(value) => setSort(value as CommunitySort)}
            options={communitySortOptions}
            ariaLabel="Sort Community posts"
            searchable={false}
            className="min-h-11 rounded-2xl"
          />
        </div>
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
                id={`community-post-${message.id}`}
                className={`rounded-3xl border bg-card p-5 shadow-card ${
                  message.moderationStatus === "hidden"
                    ? "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/10"
                    : message.isPinned
                      ? "border-primary/40 ring-1 ring-primary/10"
                      : "border-border"
                }`}
              >
                {message.moderationStatus === "hidden" && (
                  <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                    <EyeOff className="size-4" /> Hidden from Community
                    {message.moderationReason ? ` — ${message.moderationReason}` : ""}
                  </div>
                )}
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
                  <div className="flex shrink-0 items-start gap-1">
                    <p className="hidden pt-2 text-xs text-muted-foreground sm:block">
                      {new Date(message.time).toLocaleString("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 rounded-full"
                        >
                          <MoreHorizontal className="size-5" />
                          <span className="sr-only">Post options</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {message.isOwner && (
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingPostId(message.id);
                              setEditDraft(message.message);
                            }}
                          >
                            <Pencil className="size-4" /> Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={async () => {
                            setBusyMenuId(message.id);
                            try {
                              await setCommunityPostSaved({
                                data: { messageId: message.id, saved: !message.isSaved },
                              });
                              await load();
                              toast.success(
                                message.isSaved ? "Removed from saved posts." : "Post saved.",
                              );
                            } catch (error) {
                              toast.error(
                                error instanceof Error ? error.message : "Could not save post.",
                              );
                            } finally {
                              setBusyMenuId(null);
                            }
                          }}
                        >
                          {message.isSaved ? (
                            <BookmarkCheck className="size-4" />
                          ) : (
                            <Bookmark className="size-4" />
                          )}
                          {message.isSaved ? "Unsave" : "Save"}
                        </DropdownMenuItem>
                        {!message.isOwner && (
                          <DropdownMenuItem
                            disabled={message.reports.viewerReported}
                            onClick={() => {
                              setReportingPost(message);
                              setReportReason("");
                            }}
                          >
                            <Flag className="size-4" />
                            {message.reports.viewerReported ? "Reported" : "Report"}
                          </DropdownMenuItem>
                        )}
                        {message.canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={async () => {
                                const confirmed = await requestConfirmation({
                                  title: message.isOwner
                                    ? "Delete this post?"
                                    : "Remove this Community post?",
                                  description:
                                    "This permanently removes the post, attachments, comments, and reactions. Management actions are audited.",
                                  confirmLabel: "Delete post",
                                  destructive: true,
                                });
                                if (!confirmed) return;
                                setBusyDeleteId(message.id);
                                try {
                                  await deleteCommunityMessage({ data: { messageId: message.id } });
                                  await load();
                                  toast.success("Community post deleted.");
                                } catch (error) {
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Could not delete post.",
                                  );
                                } finally {
                                  setBusyDeleteId(null);
                                }
                              }}
                            >
                              <Trash2 className="size-4" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${categoryBadgeTone[message.category]}`}
                  >
                    {communityPostCategoryLabels[message.category]}
                  </span>
                  {message.category === "question" && (
                    <span className="inline-flex rounded-full border border-violet-500/25 bg-violet-500/5 px-3 py-1 text-xs font-semibold capitalize text-violet-700 dark:text-violet-300">
                      {message.questionStatus}
                    </span>
                  )}
                  {message.reports.count > 0 && message.canModerate && (
                    <span className="inline-flex rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                      {message.reports.count} {message.reports.count === 1 ? "report" : "reports"}
                    </span>
                  )}
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
                {message.attachments.length > 0 && !editing && (
                  <div
                    className={`mt-4 grid gap-2 ${message.attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
                  >
                    {message.attachments.map((attachment, index) => (
                      <a
                        key={attachment.id}
                        href={attachment.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={
                          message.attachments.length === 3 && index === 0 ? "col-span-2" : ""
                        }
                      >
                        <img
                          src={attachment.imageUrl}
                          alt={`Photo attached to ${message.author}'s post`}
                          className="max-h-96 w-full rounded-2xl border bg-muted object-cover"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                )}
                {message.category === "question" && message.isOwner && !editing && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-violet-500/5 p-3">
                    <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                      Question status
                    </span>
                    {(["open", "answered", "resolved"] as const).map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={message.questionStatus === status ? "secondary" : "ghost"}
                        className="h-8 rounded-full capitalize"
                        disabled={busyMenuId === message.id}
                        onClick={async () => {
                          setBusyMenuId(message.id);
                          try {
                            await setCommunityQuestionStatus({
                              data: { messageId: message.id, status },
                            });
                            await load();
                            toast.success(`Question marked ${status}.`);
                          } catch (error) {
                            toast.error(
                              error instanceof Error ? error.message : "Could not update question.",
                            );
                          } finally {
                            setBusyMenuId(null);
                          }
                        }}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                )}
                {message.canModerate &&
                  (message.reports.count > 0 || message.moderationStatus === "hidden") && (
                    <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <span className="w-full text-xs font-semibold text-amber-800 dark:text-amber-300">
                        Management moderation
                      </span>
                      {message.reports.reasons.length > 0 && (
                        <div className="w-full space-y-1 rounded-xl bg-background/80 p-3 text-sm">
                          {message.reports.reasons.map((report, index) => (
                            <p key={`${report.time}-${index}`} className="text-muted-foreground">
                              <Flag className="mr-1 inline size-3.5 text-red-500" /> {report.reason}
                            </p>
                          ))}
                        </div>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={async () => {
                          setBusyMenuId(message.id);
                          try {
                            await moderateCommunityPost({
                              data: {
                                messageId: message.id,
                                action: message.moderationStatus === "hidden" ? "restore" : "hide",
                                reason:
                                  message.moderationStatus === "hidden"
                                    ? ""
                                    : "Hidden after report review",
                              },
                            });
                            await load();
                            toast.success(
                              message.moderationStatus === "hidden"
                                ? "Post restored."
                                : "Post hidden.",
                            );
                          } catch (error) {
                            toast.error(
                              error instanceof Error ? error.message : "Could not moderate post.",
                            );
                          } finally {
                            setBusyMenuId(null);
                          }
                        }}
                      >
                        {message.moderationStatus === "hidden" ? (
                          <Eye className="size-4" />
                        ) : (
                          <EyeOff className="size-4" />
                        )}
                        {message.moderationStatus === "hidden" ? "Restore" : "Hide"}
                      </Button>
                      {message.reports.count > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="rounded-full"
                          onClick={async () => {
                            setBusyMenuId(message.id);
                            try {
                              await moderateCommunityPost({
                                data: {
                                  messageId: message.id,
                                  action: "dismiss",
                                  reason: "Reviewed and dismissed",
                                },
                              });
                              await load();
                              toast.success("Reports reviewed and dismissed.");
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Could not review reports.",
                              );
                            } finally {
                              setBusyMenuId(null);
                            }
                          }}
                        >
                          <CheckCircle2 className="size-4" /> Dismiss reports
                        </Button>
                      )}
                    </div>
                  )}
                {message.canPin && !editing && (
                  <div className="mt-3 flex flex-wrap gap-2">
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
                {!commentsOpen && message.comments.length > 0 && (
                  <button
                    type="button"
                    className="mt-3 w-full rounded-2xl bg-muted/50 px-4 py-3 text-left hover:bg-muted"
                    onClick={() =>
                      setExpandedComments((current) => ({ ...current, [message.id]: true }))
                    }
                  >
                    <span className="text-xs font-semibold text-muted-foreground">
                      Latest comment
                    </span>
                    <p className="mt-1 line-clamp-2 text-sm">
                      <span className="font-semibold">{message.comments.at(-1)?.author}: </span>
                      {message.comments.at(-1)?.message}
                    </p>
                  </button>
                )}
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
                              isHelpful={message.helpfulCommentId === comment.id}
                              onHelpful={
                                message.category === "question" && message.isOwner
                                  ? async () => {
                                      setBusyMenuId(message.id);
                                      try {
                                        const helpful = message.helpfulCommentId === comment.id;
                                        await setCommunityQuestionStatus({
                                          data: {
                                            messageId: message.id,
                                            status: helpful ? "open" : "answered",
                                            helpfulCommentId: helpful ? null : comment.id,
                                          },
                                        });
                                        await load();
                                        toast.success(
                                          helpful
                                            ? "Helpful answer removed."
                                            : "Helpful answer selected.",
                                        );
                                      } catch (error) {
                                        toast.error(
                                          error instanceof Error
                                            ? error.message
                                            : "Could not update helpful answer.",
                                        );
                                      } finally {
                                        setBusyMenuId(null);
                                      }
                                    }
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
                                      isHelpful={message.helpfulCommentId === reply.id}
                                      onHelpful={
                                        message.category === "question" && message.isOwner
                                          ? async () => {
                                              setBusyMenuId(message.id);
                                              try {
                                                await setCommunityQuestionStatus({
                                                  data: {
                                                    messageId: message.id,
                                                    status: "answered",
                                                    helpfulCommentId: reply.id,
                                                  },
                                                });
                                                await load();
                                                toast.success("Helpful answer selected.");
                                              } catch (error) {
                                                toast.error(
                                                  error instanceof Error
                                                    ? error.message
                                                    : "Could not update helpful answer.",
                                                );
                                              } finally {
                                                setBusyMenuId(null);
                                              }
                                            }
                                          : undefined
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
