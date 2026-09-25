import { MessageCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCommunityMessages, postCommunityMessage } from "@/lib/community-server-functions";

export function CommunityFeed({ placeholder }: { placeholder: string }) {
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof getCommunityMessages>>>([]);
  const load = async () => setMessages(await getCommunityMessages());
  useEffect(() => {
    void load().catch(() => toast.error("Could not load community messages."));
  }, []);
  return (
    <>
      <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Post an update</h2>
        </div>
        <form
          className="mt-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            try {
              await postCommunityMessage({ data: { message: String(form.get("message") ?? "") } });
              event.currentTarget.reset();
              await load();
              toast.success("Community message posted.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not post the message.");
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
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-semibold">{message.author}</p>
                <p className="text-xs text-primary">{message.role}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(message.time).toLocaleString("en-PH")}
              </p>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{message.message}</p>
          </article>
        ))}
        {messages.length === 0 && (
          <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No community messages yet.
          </p>
        )}
      </section>
    </>
  );
}
