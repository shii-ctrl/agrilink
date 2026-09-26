import { MessageCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { postCommunityMessage, getCommunityMessages } from "@/lib/community-server-functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CommunityFeed({ title, placeholder }: { title: string; placeholder: string }) {
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof getCommunityMessages>>>([]);
  const load = () =>
    void getCommunityMessages()
      .then(setMessages)
      .catch(() => toast.error("Could not load community messages."));

  useEffect(load, []);

  return (
    <>
      <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <form
          className="mt-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const message = String(new FormData(form).get("message") ?? "").trim();
            try {
              await postCommunityMessage({ data: { message } });
              form.reset();
              load();
              toast.success("Community message posted.");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not post community message.",
              );
            }
          }}
        >
          <Textarea name="message" placeholder={placeholder} required />
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
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-semibold">{message.author}</p>
                <p className="text-xs text-primary">{message.role}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(message.time).toLocaleString("en-PH")}
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{message.message}</p>
          </article>
        ))}
        {messages.length === 0 && (
          <p className="rounded-3xl border border-dashed p-6 text-sm text-muted-foreground">
            No community messages have been posted yet.
          </p>
        )}
      </section>
    </>
  );
}
