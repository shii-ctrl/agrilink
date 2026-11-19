import { createFileRoute } from "@tanstack/react-router";
import { Bot, Leaf, LoaderCircle, Plus, Send, Sprout, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/ui/toast";
import { userFacingErrorMessage } from "@/lib/ui/user-facing-error";

import { FarmerLayout, FarmerPageHeader } from "@/components/workspaces/farmer-layout";
import { Button } from "@/components/ui/button";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  askFarmerCropAi,
  deleteFarmerCropAiConversation,
  getFarmerCropAiConversation,
  getFarmerCropAiWorkspace,
} from "@/services/farmer/crop-ai-server-functions";

export const Route = createFileRoute("/farmer/crop-ai")({ component: FarmerCropAiPage });

type Workspace = Awaited<ReturnType<typeof getFarmerCropAiWorkspace>>;
type Conversation = Workspace["conversations"][number];
type ChatMessage = Awaited<ReturnType<typeof getFarmerCropAiConversation>>["messages"][number];

const questionSuggestions = [
  "Ano ang magandang itanim ngayong season sa Quezon?",
  "Paano ihanda ang lupa bago magtanim?",
  "Paano alagaan ang aking pananim?",
  "Kailan puwedeng anihin ang aking ani?",
];

function dateLabel(value: string | null) {
  if (!value) return "Planting date not added";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function cropAiErrorMessage(reason: unknown) {
  const message = cropAiErrorText(reason) ?? "Could not ask Crop AI.";
  if (
    message.includes("Failed query:") ||
    message.includes("farmer_ai_messages") ||
    message.includes("farmer_ai_conversations")
  ) {
    return "Crop AI could not save this conversation. Please try again.";
  }
  if (
    message.includes('"question"') ||
    message.includes("Ask a crop question") ||
    message.includes("Ask a farm question")
  ) {
    return "Write your farm question first.";
  }
  return message.startsWith("[")
    ? "Crop AI could not read that request. Please try again."
    : message;
}

function cropAiErrorText(reason: unknown, depth = 0): string | null {
  if (typeof reason === "string") return reason;
  if (reason instanceof Error) return reason.message;
  if (!reason || typeof reason !== "object" || depth >= 3) return null;

  const details = reason as Record<string, unknown>;
  if (typeof details["message"] === "string") return details["message"];

  for (const key of ["data", "cause", "error"]) {
    const nestedMessage = cropAiErrorText(details[key], depth + 1);
    if (nestedMessage) return nestedMessage;
  }
  return null;
}

function FarmerCropAiPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cropName, setCropName] = useState("");
  const [plantingDate, setPlantingDate] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { requestConfirmation, confirmationDialog } = useConfirmAction();

  const loadWorkspace = useCallback(async () => {
    try {
      const result = await getFarmerCropAiWorkspace();
      setWorkspace(result);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Crop AI.");
    } finally {
      setLoading(false);
    }
  }, []);

  const openConversation = useCallback(async (conversation: Conversation) => {
    setActiveConversation(conversation);
    setCropName(conversation.cropName);
    setPlantingDate(conversation.plantingDate ?? "");
    setLoadingConversation(true);
    try {
      const result = await getFarmerCropAiConversation({
        data: { conversationId: conversation.id },
      });
      setMessages(result.messages);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load this conversation.");
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const startNewChat = useCallback(() => {
    setActiveConversation(null);
    setCropName("");
    setPlantingDate("");
    setQuestion("");
    setMessages([]);
    setPendingQuestion(null);
    setError(null);
  }, []);

  const deleteConversation = useCallback(
    async (conversationId: string, conversationCropName: string) => {
      const accepted = await requestConfirmation({
        title: "Delete saved question?",
        description:
          "This permanently deletes your saved " +
          conversationCropName +
          " question and every Crop AI answer in it.",
        confirmLabel: "Delete question",
        cancelLabel: "Keep question",
        destructive: true,
        holdToConfirmMs: 3_000,
      });

      if (!accepted) return;

      setDeletingConversationId(conversationId);
      try {
        await deleteFarmerCropAiConversation({ data: { conversationId } });
        setWorkspace((current) =>
          current
            ? {
                ...current,
                conversations: current.conversations.filter(
                  (conversation) => conversation.id !== conversationId,
                ),
              }
            : current,
        );
        if (activeConversation?.id === conversationId) startNewChat();
        toast.success("Saved farm question deleted.");
      } catch (reason) {
        console.error("Unable to delete Crop AI conversation.", reason);
        const message = "Could not delete this saved farm question. Please try again.";
        setError(message);
        toast.error(message);
      } finally {
        setDeletingConversationId(null);
      }
    },
    [activeConversation?.id, requestConfirmation, startNewChat],
  );

  return (
    <FarmerLayout>
      {confirmationDialog}
      <FarmerPageHeader
        title="Ask Crop AI"
        description="Get practical Quezon Province guidance for seasonal planting, crop care, harvest timing, and farm planning."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        {loading ? (
          <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading Crop AI…
          </div>
        ) : error && !workspace ? (
          <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold">Could not load Crop AI</h2>
            <p className="mt-2 text-sm text-muted-foreground">{userFacingErrorMessage(error)}</p>
            <Button className="mt-4 rounded-full" onClick={() => void loadWorkspace()}>
              Try again
            </Button>
          </section>
        ) : (
          <section className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-card lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="border-b border-border bg-muted/20 p-4 lg:border-b-0 lg:border-r">
              <Button className="w-full rounded-full" onClick={startNewChat}>
                <Plus className="size-4" /> New farm question
              </Button>
              <p className="mt-5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saved farm questions
              </p>
              <div className="mt-2 space-y-1">
                {workspace?.conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="group relative overflow-hidden rounded-2xl border border-transparent transition-colors hover:border-border"
                  >
                    <button
                      type="button"
                      onClick={() => void openConversation(conversation)}
                      className={[
                        "w-full rounded-2xl p-3 pr-11 text-left transition-colors hover:bg-accent",
                        conversation.id === activeConversation?.id ? "bg-primary/10" : "",
                      ].join(" ")}
                    >
                      <span className="flex items-start gap-2">
                        <Leaf className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {conversation.cropName}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {dateLabel(conversation.plantingDate)}
                          </span>
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void deleteConversation(conversation.id, conversation.cropName)
                      }
                      disabled={deletingConversationId === conversation.id}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={"Delete saved question for " + conversation.cropName}
                    >
                      {deletingConversationId === conversation.id ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                ))}
                {!workspace?.conversations.length && (
                  <p className="px-2 py-6 text-sm text-muted-foreground">
                    Your saved farm questions will appear here.
                  </p>
                )}
              </div>
            </aside>
            <div className="min-w-0">
              <div className="border-b border-border px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Bot className="size-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold">
                        {activeConversation ? activeConversation.cropName : "Start a farm question"}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Ask about planting choices, crop care, harvesting, or farm planning in
                        Quezon Province.
                      </p>
                    </div>
                  </div>
                  {workspace && (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {workspace.remainingQuestions} of {workspace.questionLimit} questions left
                    </span>
                  )}
                </div>
              </div>
              <div className="min-h-[22rem] space-y-4 bg-muted/10 p-5">
                {loadingConversation ? (
                  <div className="flex justify-center pt-12 text-sm text-muted-foreground">
                    <LoaderCircle className="mr-2 size-4 animate-spin" /> Loading conversation…
                  </div>
                ) : messages.length || pendingQuestion ? (
                  <>
                    <>
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender === "farmer" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.sender === "farmer" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-background"}`}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{message.message}</p>
                            <p
                              className={`mt-2 text-[11px] ${message.sender === "farmer" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                            >
                              {message.sender === "farmer" ? "You" : "Crop AI"} ·{" "}
                              {new Date(message.createdAt).toLocaleString("en-PH", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </>
                    {pendingQuestion && (
                      <div className="flex justify-end">
                        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
                          <p className="whitespace-pre-wrap leading-relaxed">{pendingQuestion}</p>
                          <p className="mt-2 text-[11px] text-primary-foreground/70">
                            You · sending…
                          </p>
                        </div>
                      </div>
                    )}
                    {sending && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                          <LoaderCircle className="size-4 animate-spin text-primary" /> Crop AI is
                          preparing a short answer…
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center text-center text-sm text-muted-foreground">
                    <Sprout className="mb-3 size-8 text-primary" />
                    Ask about planting, crop care, harvest timing, or seasonal conditions in Quezon
                    Province.
                  </div>
                )}
              </div>
              {error && (
                <p className="border-t border-border bg-destructive/5 px-5 py-3 text-sm text-destructive">
                  {userFacingErrorMessage(error)}
                </p>
              )}
              <form
                className="border-t border-border p-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (sending) return;
                  if (question.trim().length < 2) {
                    const message = "Write your farm question first.";
                    setError(message);
                    toast.error(message);
                    return;
                  }
                  const submittedQuestion = question.trim();
                  setPendingQuestion(submittedQuestion);
                  setSending(true);
                  try {
                    const result = await askFarmerCropAi({
                      data: {
                        conversationId: activeConversation?.id,
                        cropName,
                        plantingDate,
                        question: submittedQuestion,
                      },
                    });
                    setActiveConversation(result.conversation);
                    setMessages((current) =>
                      activeConversation?.id === result.conversation.id
                        ? [...current, ...result.messages]
                        : result.messages,
                    );
                    setWorkspace((current) =>
                      current
                        ? {
                            ...current,
                            remainingQuestions: result.remainingQuestions,
                            conversations: [
                              result.conversation,
                              ...current.conversations.filter(
                                (item) => item.id !== result.conversation.id,
                              ),
                            ],
                          }
                        : current,
                    );
                    setQuestion("");
                    setPendingQuestion(null);
                    setError(null);
                  } catch (reason) {
                    const message = cropAiErrorMessage(reason);
                    setPendingQuestion(null);
                    setError(message);
                    toast.error(message);
                  } finally {
                    setSending(false);
                  }
                }}
              >
                <div className="mb-3">
                  <p className="text-xs font-medium text-muted-foreground">Try asking</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {questionSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setQuestion(suggestion);
                          if (error) setError(null);
                        }}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs font-medium transition-colors hover:border-primary hover:text-primary"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Textarea
                    value={question}
                    onChange={(event) => {
                      setQuestion(event.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Example: Ano ang magandang itanim ngayong season sa Quezon?"
                    rows={2}
                    maxLength={1_000}
                    required
                  />
                  <Button
                    type="submit"
                    className="rounded-full sm:self-end"
                    disabled={
                      sending || !workspace?.remainingQuestions || question.trim().length < 2
                    }
                  >
                    {sending ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}{" "}
                    {sending ? "Crop AI is thinking…" : "Ask Crop AI"}
                  </Button>
                </div>
              </form>
            </div>
          </section>
        )}
      </main>
    </FarmerLayout>
  );
}
