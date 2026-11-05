import {
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/ui/toast";
import { userFacingErrorMessage } from "@/lib/ui/user-facing-error";

import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getDirectConversation,
  getDirectMessageWorkspace,
  getDirectTyping,
  sendDirectMessage,
  updateDirectTyping,
} from "@/services/messaging/direct-message-server-functions";

type Workspace = Awaited<ReturnType<typeof getDirectMessageWorkspace>>;
type Contact = Workspace["contacts"][number];
type ConversationMessage = Awaited<ReturnType<typeof getDirectConversation>>[number];
type LocalMessage = {
  id: string;
  participantId: string;
  message: string;
  isMine: true;
  time: string;
  status: "sending" | "failed";
};

const statusLabels = {
  sending: "Sending…",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Not sent",
} as const;

function messageStatusLabel(status: string) {
  return statusLabels[status as keyof typeof statusLabels] ?? "Sent";
}

function ContactAvatar({
  contact,
  className = "size-9",
  viewable = true,
}: {
  contact: Pick<Contact, "name" | "avatarUrl">;
  className?: string;
  viewable?: boolean;
}) {
  return (
    <ProfileAvatar
      name={contact.name}
      avatarUrl={contact.avatarUrl}
      className={className}
      viewable={viewable}
    />
  );
}

function MessagesSkeleton() {
  return (
    <div
      className="grid min-h-[36rem] lg:grid-cols-[18rem_minmax(0,1fr)]"
      aria-label="Loading private messages"
    >
      <div className="space-y-3 border-b border-border p-4 lg:border-b-0 lg:border-r">
        <Skeleton className="h-10 w-full rounded-xl" />
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-2xl p-2">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-5 p-6">
        <Skeleton className="h-14 w-52 rounded-2xl" />
        <Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" />
        <Skeleton className="h-20 w-3/4 rounded-2xl" />
        <Skeleton className="ml-auto h-14 w-1/2 rounded-2xl" />
      </div>
    </div>
  );
}

export function DirectMessagesPanel({
  initialContactId = "",
}: {
  initialContactId?: string | undefined;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const localMessagesRef = useRef<LocalMessage[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [contactTyping, setContactTyping] = useState(false);

  const syncLocalMessages = useCallback((next: LocalMessage[]) => {
    localMessagesRef.current = next;
    setLocalMessages(next);
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      const result = await getDirectMessageWorkspace();
      setWorkspace(result);
      setSelectedContactId((current) =>
        result.contacts.some((contact) => contact.id === current)
          ? current
          : result.contacts.some((contact) => contact.id === initialContactId)
            ? initialContactId
            : (result.contacts[0]?.id ?? ""),
      );
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load private messages.");
    } finally {
      setLoading(false);
    }
  }, [initialContactId]);

  const loadConversation = useCallback(async (participantId: string, silent = false) => {
    if (!participantId) {
      setMessages([]);
      return;
    }
    if (!silent) setLoadingConversation(true);
    try {
      setMessages(await getDirectConversation({ data: { participantId } }));
      setError(null);
    } catch (reason) {
      if (!silent) {
        setError(reason instanceof Error ? reason.message : "Could not load this conversation.");
      }
    } finally {
      if (!silent) setLoadingConversation(false);
    }
  }, []);

  const transmitMessage = useCallback(
    async (queuedMessage: LocalMessage) => {
      if (!navigator.onLine) {
        syncLocalMessages(
          localMessagesRef.current.map((item) =>
            item.id === queuedMessage.id ? { ...item, status: "failed" } : item,
          ),
        );
        return;
      }
      syncLocalMessages(
        localMessagesRef.current.map((item) =>
          item.id === queuedMessage.id ? { ...item, status: "sending" } : item,
        ),
      );
      try {
        await sendDirectMessage({
          data: {
            participantId: queuedMessage.participantId,
            message: queuedMessage.message,
            clientMessageId: queuedMessage.id,
          },
        });
        syncLocalMessages(localMessagesRef.current.filter((item) => item.id !== queuedMessage.id));
        await Promise.all([loadConversation(queuedMessage.participantId, true), loadWorkspace()]);
      } catch (reason) {
        syncLocalMessages(
          localMessagesRef.current.map((item) =>
            item.id === queuedMessage.id ? { ...item, status: "failed" } : item,
          ),
        );
        toast.error(userFacingErrorMessage(reason, "Could not send the message. Try again."));
      }
    },
    [loadConversation, loadWorkspace, syncLocalMessages],
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!selectedContactId) {
      setMessages([]);
      return;
    }
    void loadConversation(selectedContactId).then(() => loadWorkspace());
  }, [loadConversation, loadWorkspace, selectedContactId]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      void loadConversation(selectedContactId, true).then(() => loadWorkspace());
    };
    const polling = window.setInterval(refresh, 5_000);
    return () => window.clearInterval(polling);
  }, [loadConversation, loadWorkspace, selectedContactId]);

  useEffect(() => {
    const updateOnlineState = () => {
      const nextOnline = navigator.onLine;
      setOnline(nextOnline);
      if (nextOnline) {
        for (const message of localMessagesRef.current.filter((item) => item.status === "failed")) {
          void transmitMessage(message);
        }
      }
    };
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, [transmitMessage]);

  useEffect(() => {
    if (!selectedContactId || !online) {
      setContactTyping(false);
      return;
    }
    const checkTyping = () => {
      void getDirectTyping({ data: { participantId: selectedContactId } })
        .then((result) => setContactTyping(result.isTyping))
        .catch(() => setContactTyping(false));
    };
    checkTyping();
    const timer = window.setInterval(checkTyping, 1_500);
    return () => window.clearInterval(timer);
  }, [online, selectedContactId]);

  const selectedContact = workspace?.contacts.find((contact) => contact.id === selectedContactId);

  useEffect(() => {
    if (!selectedContact?.canSend || !online) return;
    const timer = window.setTimeout(() => {
      void updateDirectTyping({
        data: { participantId: selectedContact.id, isTyping: draft.trim().length > 0 },
      }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, online, selectedContact?.canSend, selectedContact?.id]);

  useEffect(
    () => () => {
      if (selectedContactId) {
        void updateDirectTyping({
          data: { participantId: selectedContactId, isTyping: false },
        }).catch(() => undefined);
      }
    },
    [selectedContactId],
  );

  const contacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return workspace?.contacts ?? [];
    return (workspace?.contacts ?? []).filter((contact) =>
      `${contact.name} ${contact.role}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query, workspace?.contacts]);

  const displayedMessages = useMemo(
    () =>
      [
        ...messages,
        ...localMessages.filter((message) => message.participantId === selectedContactId),
      ].sort((left, right) => Date.parse(left.time) - Date.parse(right.time)),
    [localMessages, messages, selectedContactId],
  );

  const sendDraft = async () => {
    const message = draft.trim();
    if (!message || !selectedContact?.canSend) return;
    const queuedMessage: LocalMessage = {
      id: crypto.randomUUID(),
      participantId: selectedContact.id,
      message,
      isMine: true,
      time: new Date().toISOString(),
      status: online ? "sending" : "failed",
    };
    setDraft("");
    syncLocalMessages([...localMessagesRef.current, queuedMessage]);
    void updateDirectTyping({
      data: { participantId: selectedContact.id, isTyping: false },
    }).catch(() => undefined);
    if (!online) {
      toast.info("You are offline. This message will retry automatically when connected.");
      return;
    }
    await transmitMessage(queuedMessage);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Private messages</h2>
            <p className="text-sm text-muted-foreground">
              Conversations are limited to people connected to your current work or order.
            </p>
          </div>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" /> Saved and role-protected
        </p>
      </div>

      {!online && (
        <div className="flex items-center gap-2 border-b border-amber-300/50 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <WifiOff className="size-4" /> You are offline. Messages will retry automatically when
          your connection returns.
        </div>
      )}

      {loading ? (
        <MessagesSkeleton />
      ) : error && !workspace ? (
        <div className="p-6">
          <p className="font-medium">Could not load private messages</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {userFacingErrorMessage(error, "Could not load this conversation. Please try again.")}
          </p>
          <Button
            className="mt-4 rounded-full"
            variant="outline"
            onClick={() => void loadWorkspace()}
          >
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      ) : (
        <div className="grid min-h-[36rem] lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="border-b border-border bg-muted/20 p-4 lg:border-b-0 lg:border-r">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people or roles"
                aria-label="Search private message contacts"
                className="pl-9"
              />
            </div>
            <div className="mt-4 space-y-1">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => setSelectedContactId(contact.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-accent ${
                    contact.id === selectedContactId ? "bg-primary/10" : ""
                  }`}
                >
                  <ContactAvatar contact={contact} viewable={false} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{contact.name}</span>
                      {contact.unreadCount > 0 && (
                        <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-5 text-primary-foreground">
                          {contact.unreadCount > 99 ? "99+" : contact.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-primary">
                      <span
                        className={`size-1.5 rounded-full ${contact.canSend ? "bg-emerald-500" : "bg-muted-foreground"}`}
                      />
                      {contact.role} · {contact.canSend ? "Available" : "History only"}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {contact.lastMessage ?? "Start a conversation"}
                    </span>
                  </span>
                </button>
              ))}
              {contacts.length === 0 && (
                <div className="px-2 py-6 text-sm text-muted-foreground">
                  <p>No conversations yet.</p>
                  <Button
                    variant="outline"
                    className="mt-3 rounded-full"
                    onClick={() => searchRef.current?.focus()}
                  >
                    Start conversation
                  </Button>
                </div>
              )}
            </div>
          </aside>

          <div className="flex min-w-0 flex-col">
            {selectedContact ? (
              <>
                <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                  <ContactAvatar contact={selectedContact} className="size-10" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{selectedContact.name}</p>
                    <p className="text-xs text-primary">
                      {selectedContact.role} ·{" "}
                      {selectedContact.canSend
                        ? "Available for this workflow"
                        : "Conversation history"}
                    </p>
                    {contactTyping && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {selectedContact.name} is typing…
                      </p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="flex items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/5 px-5 py-3 text-sm">
                    <span>
                      {userFacingErrorMessage(error, "Could not refresh this conversation.")}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void loadConversation(selectedContact.id)}
                    >
                      <RefreshCw className="size-4" /> Retry
                    </Button>
                  </div>
                )}

                <div className="flex-1 space-y-3 overflow-y-auto bg-muted/10 p-5">
                  {loadingConversation ? (
                    <div className="space-y-4 pt-4">
                      <Skeleton className="h-16 w-2/3 rounded-2xl" />
                      <Skeleton className="ml-auto h-20 w-3/4 rounded-2xl" />
                      <Skeleton className="h-14 w-1/2 rounded-2xl" />
                    </div>
                  ) : displayedMessages.length ? (
                    displayedMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex items-end gap-2 ${message.isMine ? "justify-end" : "justify-start"}`}
                      >
                        {!message.isMine && (
                          <ContactAvatar contact={selectedContact} className="size-7" />
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            message.isMine
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md bg-background"
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{message.message}</p>
                          <div
                            className={`mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px] ${
                              message.isMine
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            <span>
                              {new Date(message.time).toLocaleString("en-PH", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </span>
                            {message.isMine && <span>{messageStatusLabel(message.status)}</span>}
                            {message.isMine && message.status === "failed" && (
                              <button
                                type="button"
                                className="font-semibold underline underline-offset-2"
                                onClick={() => void transmitMessage(message as LocalMessage)}
                              >
                                Retry
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex min-h-52 flex-col items-center justify-center text-center text-sm text-muted-foreground">
                      <MessageCircle className="mb-3 size-8 text-primary" />
                      <p className="font-medium text-foreground">No messages yet</p>
                      <p className="mt-1">
                        Start a private conversation with {selectedContact.name}.
                      </p>
                      {selectedContact.canSend && (
                        <Button
                          variant="outline"
                          className="mt-4 rounded-full"
                          onClick={() => composerRef.current?.focus()}
                        >
                          Start conversation
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <form
                  className="border-t border-border p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendDraft();
                  }}
                >
                  {selectedContact.canSend ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Textarea
                        ref={composerRef}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={`Message ${selectedContact.name}…`}
                        maxLength={4_000}
                        rows={2}
                        required
                      />
                      <Button
                        type="submit"
                        className="rounded-full sm:self-end"
                        disabled={!draft.trim()}
                      >
                        {localMessages.some((item) => item.status === "sending") ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        Send
                      </Button>
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                      This conversation is read-only because there is no active workflow or delivery
                      connecting your roles.
                    </p>
                  )}
                </form>
              </>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <UserRound className="mb-3 size-8 text-primary" />
                <p className="font-medium text-foreground">No conversations yet</p>
                <p className="mt-1 text-sm">Choose an available contact to start messaging.</p>
                <Button
                  variant="outline"
                  className="mt-4 rounded-full"
                  onClick={() => searchRef.current?.focus()}
                >
                  Start conversation
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
