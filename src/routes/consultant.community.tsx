import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConsultantLayout, ConsultantPageHeader } from "@/components/consultant-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { demoCommunityMessages } from "@/lib/demo-data";
export const Route = createFileRoute("/consultant/community")({
  component: ConsultantCommunityPage,
});
function ConsultantCommunityPage() {
  const [messages, setMessages] = useState(demoCommunityMessages);
  return (
    <ConsultantLayout>
      <ConsultantPageHeader
        title="Community"
        description="Share crop information and operational updates through AgriLink’s message-only community space."
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Community supports messages only. Reactions, likes, followers, and unrelated social
          features are not included.
        </div>
        <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Post an update</h2>
          </div>
          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              const message = String(new FormData(event.currentTarget).get("message") ?? "").trim();
              if (!message) return;
              setMessages((current) => [
                {
                  id: `consultant-community-${Date.now()}`,
                  author: "Ana Garcia",
                  role: "Farm Consultant",
                  time: "Just now",
                  message,
                },
                ...current,
              ]);
              event.currentTarget.reset();
              toast("Temporary community message posted");
            }}
          >
            <Textarea
              name="message"
              placeholder="Share crop guidance or an operational update..."
              required
            />
            <Button type="submit" className="mt-3 rounded-full">
              <Send className="size-4" /> Post update
            </Button>
          </form>
        </section>
        <section className="mt-6 space-y-4">
          {messages.map((message) => (
            <article
              key={message.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold">{message.author}</p>
                  <p className="text-xs text-primary">{message.role}</p>
                </div>
                <p className="text-xs text-muted-foreground">{message.time}</p>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{message.message}</p>
            </article>
          ))}
        </section>
      </main>
    </ConsultantLayout>
  );
}
