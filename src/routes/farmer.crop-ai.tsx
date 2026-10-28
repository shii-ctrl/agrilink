import { createFileRoute } from "@tanstack/react-router";
import { Bot, Leaf, LoaderCircle, Plus, Send, ShieldAlert, Sprout } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { FarmerLayout, FarmerPageHeader } from "@/components/workspaces/farmer-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  askFarmerCropAi,
  getFarmerCropAiConversation,
  getFarmerCropAiWorkspace,
} from "@/services/farmer/crop-ai-server-functions";

export const Route = createFileRoute("/farmer/crop-ai")({ component: FarmerCropAiPage });

type Workspace = Awaited<ReturnType<typeof getFarmerCropAiWorkspace>>;
type Conversation = Workspace["conversations"][number];
type ChatMessage = Awaited<ReturnType<typeof getFarmerCropAiConversation>>["messages"][number];

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
  if (message.includes("Failed query:") || message.includes("farmer_ai_messages")) {
    return "Crop AI could not save this conversation. Please try again.";
  }
  if (message.includes('"cropName"') || message.includes("Enter the crop name")) {
    return "Enter the crop name first, for example Pechay or Ampalaya.";
  }
  if (message.includes('"question"') || message.includes("Ask a crop question")) {
    return "Write your crop question first.";
  }
  return message.startsWith("[") ? "Crop AI could not read that request. Please try again." : message;
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
  const [error, setError] = useState<string | null>(null);

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
      const result = await getFarmerCropAiConversation({ data: { conversationId: conversation.id } });
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

  const startNewChat = () => {
    setActiveConversation(null);
    setCropName("");
    setPlantingDate("");
    setQuestion("");
    setMessages([]);
    setPendingQuestion(null);
    setError(null);
  };

  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="Ask Crop AI"
        description="Get practical crop guidance based on your crop and planting date."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm">
          <div className="flex max-w-3xl gap-2 text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              Crop AI gives general guidance only. For severe crop problems, pesticide decisions, or an on-site check, contact PROCY or a local agricultural technician.
            </p>
          </div>
          {workspace && <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary">{workspace.remainingQuestions} of {workspace.questionLimit} questions left</span>}
        </div>
        {loading ? (
          <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading Crop AI…</div>
        ) : error && !workspace ? (
          <section className="rounded-3xl border border-border bg-card p-6 shadow-card"><h2 className="text-lg font-semibold">Could not load Crop AI</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-4 rounded-full" onClick={() => void loadWorkspace()}>Try again</Button></section>
        ) : (
          <section className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-card lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="border-b border-border bg-muted/20 p-4 lg:border-b-0 lg:border-r">
              <Button className="w-full rounded-full" onClick={startNewChat}><Plus className="size-4" /> New crop question</Button>
              <p className="mt-5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saved questions</p>
              <div className="mt-2 space-y-1">
                {workspace?.conversations.map((conversation) => (
                  <button key={conversation.id} type="button" onClick={() => void openConversation(conversation)} className={`w-full rounded-2xl p-3 text-left transition-colors hover:bg-accent ${conversation.id === activeConversation?.id ? "bg-primary/10" : ""}`}>
                    <span className="flex items-center gap-2 text-sm font-semibold"><Leaf className="size-4 text-primary" />{conversation.cropName}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{dateLabel(conversation.plantingDate)}</span>
                  </button>
                ))}
                {!workspace?.conversations.length && <p className="px-2 py-6 text-sm text-muted-foreground">Your saved crop questions will appear here.</p>}
              </div>
            </aside>
            <div className="min-w-0">
              <div className="border-b border-border px-5 py-5">
                <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bot className="size-5" /></span><div><h2 className="font-semibold">{activeConversation ? activeConversation.cropName : "Start a crop question"}</h2><p className="text-xs text-muted-foreground">Tell Crop AI what you planted and ask what you need to know.</p></div></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Crop name <span className="text-destructive">*</span><Input value={cropName} onChange={(event) => { setCropName(event.target.value); if (error) setError(null); }} placeholder="Example: Ampalaya" maxLength={160} required minLength={2} /></label><label className="grid gap-1.5 text-sm font-medium">Planting date <span className="font-normal text-muted-foreground">(optional)</span><Input type="date" value={plantingDate} onChange={(event) => setPlantingDate(event.target.value)} /></label></div>
              </div>
              <div className="min-h-[22rem] space-y-4 bg-muted/10 p-5">
                {loadingConversation ? <div className="flex justify-center pt-12 text-sm text-muted-foreground"><LoaderCircle className="mr-2 size-4 animate-spin" /> Loading conversation…</div> : messages.length || pendingQuestion ? <><>{messages.map((message) => <div key={message.id} className={`flex ${message.sender === "farmer" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.sender === "farmer" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-background"}`}><p className="whitespace-pre-wrap leading-relaxed">{message.message}</p><p className={`mt-2 text-[11px] ${message.sender === "farmer" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{message.sender === "farmer" ? "You" : "Crop AI"} · {new Date(message.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</p></div></div>)}</>{pendingQuestion && <div className="flex justify-end"><div className="max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm"><p className="whitespace-pre-wrap leading-relaxed">{pendingQuestion}</p><p className="mt-2 text-[11px] text-primary-foreground/70">You · sending…</p></div></div>}{sending && <div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm"><LoaderCircle className="size-4 animate-spin text-primary" /> Crop AI is preparing a short answer…</div></div>}</> : <div className="flex min-h-56 flex-col items-center justify-center text-center text-sm text-muted-foreground"><Sprout className="mb-3 size-8 text-primary" />Ask about harvest timing, crop care, or what to observe in your field.</div>}
              </div>
              {error && <p className="border-t border-border bg-destructive/5 px-5 py-3 text-sm text-destructive">{error}</p>}
              <form className="border-t border-border p-4" onSubmit={async (event) => { event.preventDefault(); if (sending) return; if (cropName.trim().length < 2) { const message = "Enter the crop name first, for example Pechay or Ampalaya."; setError(message); toast.error(message); return; } if (question.trim().length < 2) { const message = "Write your crop question first."; setError(message); toast.error(message); return; } const submittedQuestion = question.trim(); setPendingQuestion(submittedQuestion); setSending(true); try { const result = await askFarmerCropAi({ data: { conversationId: activeConversation?.id, cropName, plantingDate, question: submittedQuestion } }); setActiveConversation(result.conversation); setMessages((current) => activeConversation?.id === result.conversation.id ? [...current, ...result.messages] : result.messages); setWorkspace((current) => current ? { ...current, remainingQuestions: result.remainingQuestions, conversations: [result.conversation, ...current.conversations.filter((item) => item.id !== result.conversation.id)] } : current); setQuestion(""); setPendingQuestion(null); setError(null); } catch (reason) { const message = cropAiErrorMessage(reason); setPendingQuestion(null); setError(message); toast.error(message); } finally { setSending(false); } }}>
                <div className="flex flex-col gap-2 sm:flex-row"><Textarea value={question} onChange={(event) => { setQuestion(event.target.value); if (error) setError(null); }} placeholder="Example: Kailan po kaya puwedeng anihin ang ampalaya ko?" rows={2} maxLength={1_000} required /><Button type="submit" className="rounded-full sm:self-end" disabled={sending || !workspace?.remainingQuestions || cropName.trim().length < 2 || question.trim().length < 2}>{sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} {sending ? "Crop AI is thinking…" : "Ask Crop AI"}</Button></div>
              </form>
            </div>
          </section>
        )}
      </main>
    </FarmerLayout>
  );
}
