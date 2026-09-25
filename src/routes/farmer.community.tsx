import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FarmerLayout, FarmerPageHeader } from "@/components/farmer-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { demoCommunityMessages } from "@/lib/demo-data";
export const Route = createFileRoute("/farmer/community")({ component: FarmerCommunityPage });
function FarmerCommunityPage() {
  const [messages, setMessages] = useState(demoCommunityMessages);
  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="Community"
        description="Share updates with the AgriLink community using the system’s message-only community space."
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Community supports messages only. Likes, follows, reactions, and unrelated social-media
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
                  id: `farmer-community-${Date.now()}`,
                  author: "Juan Dela Cruz",
                  role: "Farmer Member",
                  time: "Just now",
                  message,
                },
                ...current,
              ]);
              event.currentTarget.reset();
              toast("Temporary community message posted");
            }}
          >
            <Textarea name="message" placeholder="Share a production update..." required />
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
    </FarmerLayout>
  );
}
