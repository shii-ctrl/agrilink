import { LoaderCircle, MessageCircle, Search, Send, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getDirectConversation,
  getDirectMessageWorkspace,
  sendDirectMessage,
} from "@/services/messaging/direct-message-server-functions";

type Workspace = Awaited<ReturnType<typeof getDirectMessageWorkspace>>;
type Contact = Workspace["contacts"][number];
type ConversationMessage = Awaited<ReturnType<typeof getDirectConversation>>[number];

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

export function DirectMessagesPanel() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      const result = await getDirectMessageWorkspace();
      setWorkspace(result);
      setSelectedContactId((current) =>
        result.contacts.some((contact) => contact.id === current)
          ? current
          : (result.contacts[0]?.id ?? ""),
      );
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load private messages.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    void loadConversation(selectedContactId);
  }, [loadConversation, selectedContactId]);

  useEffect(() => {
    const polling = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadWorkspace();
        void loadConversation(selectedContactId, true);
      }
    }, 5_000);
    return () => window.clearInterval(polling);
  }, [loadConversation, loadWorkspace, selectedContactId]);

  const contacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return workspace?.contacts ?? [];
    return (workspace?.contacts ?? []).filter((contact) =>
      `${contact.name} ${contact.role}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query, workspace?.contacts]);
  const selectedContact = workspace?.contacts.find((contact) => contact.id === selectedContactId);

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
              Message only the people your role is allowed to contact.
            </p>
          </div>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" /> Saved and role-protected
        </p>
      </div>
      {loading ? (
        <div className="flex min-h-72 items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading private messages…
        </div>
      ) : error && !workspace ? (
        <div className="p-6">
          <p className="font-medium">Could not load private messages</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button
            className="mt-4 rounded-full"
            variant="outline"
            onClick={() => void loadWorkspace()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="grid min-h-[36rem] lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="border-b border-border bg-muted/20 p-4 lg:border-b-0 lg:border-r">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people"
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
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{contact.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {contact.role}
                    </span>
                  </span>
                </button>
              ))}
              {contacts.length === 0 && (
                <p className="px-2 py-6 text-sm text-muted-foreground">
                  No available private conversations yet.
                </p>
              )}
            </div>
          </aside>
          <div className="flex min-w-0 flex-col">
            {selectedContact ? (
              <>
                <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                  <ContactAvatar contact={selectedContact} className="size-10" />
                  <div>
                    <p className="font-semibold">{selectedContact.name}</p>
                    <p className="text-xs text-primary">{selectedContact.role}</p>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-muted/10 p-5">
                  {loadingConversation ? (
                    <div className="flex justify-center pt-10 text-sm text-muted-foreground">
                      <LoaderCircle className="mr-2 size-4 animate-spin" /> Loading conversation…
                    </div>
                  ) : messages.length ? (
                    messages.map((message) => (
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
                          <p
                            className={`mt-2 text-[11px] ${
                              message.isMine
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {new Date(message.time).toLocaleString("en-PH", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex min-h-52 flex-col items-center justify-center text-center text-sm text-muted-foreground">
                      <MessageCircle className="mb-3 size-8 text-primary" />
                      No messages yet. Start this conversation below.
                    </div>
                  )}
                </div>
                <form
                  className="border-t border-border p-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const message = draft.trim();
                    if (!message || !selectedContact.canSend) return;
                    setSending(true);
                    try {
                      await sendDirectMessage({
                        data: { participantId: selectedContact.id, message },
                      });
                      setDraft("");
                      await loadConversation(selectedContact.id);
                    } catch (reason) {
                      toast.error(
                        reason instanceof Error ? reason.message : "Could not send the message.",
                      );
                    } finally {
                      setSending(false);
                    }
                  }}
                >
                  {selectedContact.canSend ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={`Message ${selectedContact.name}…`}
                        maxLength={4_000}
                        rows={2}
                        required
                      />
                      <Button type="submit" className="rounded-full sm:self-end" disabled={sending}>
                        {sending ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        Send
                      </Button>
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                      You can read this message, but your role cannot reply in this private thread.
                    </p>
                  )}
                </form>
              </>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <UserRound className="mb-3 size-8 text-primary" />
                Select a person to view a private conversation.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
