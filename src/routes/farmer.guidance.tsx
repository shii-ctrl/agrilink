import { createFileRoute } from "@tanstack/react-router";
import { Send, Sprout } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FarmerLayout, FarmerPageHeader } from "@/components/farmer-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendDemoNotification } from "@/lib/demo-notifications";
export const Route = createFileRoute("/farmer/guidance")({ component: FarmerGuidancePage });
const initial = [
  {
    id: "guide-1",
    author: "Ana Garcia",
    role: "Farm Consultant",
    time: "Today, 9:10 AM",
    message:
      "Please monitor tomato plants regularly and report any production concerns through this crop guidance conversation.",
  },
];
function FarmerGuidancePage() {
  const [messages, setMessages] = useState(initial);
  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="Crop Guidance"
        description="Read crop guidance from your Farm Consultant and share production concerns for follow-up."
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <Sprout className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Guidance conversation</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            This focused thread is for production and crop concerns, not marketplace or buyer
            communication.
          </p>
          <form
            className="mt-5"
            onSubmit={(event) => {
              event.preventDefault();
              const message = String(new FormData(event.currentTarget).get("message") ?? "").trim();
              if (!message) return;
              setMessages((current) => [
                ...current,
                {
                  id: `farmer-${Date.now()}`,
                  author: "Juan Dela Cruz",
                  role: "Farmer Member",
                  time: "Just now",
                  message,
                },
              ]);
              sendDemoNotification({
                role: "Farm Consultant",
                title: "New farmer crop concern",
                message: `Juan Dela Cruz: ${message}`,
                target: "/consultant/guidance",
              });
              event.currentTarget.reset();
              toast("Temporary guidance message sent");
            }}
          >
            <Textarea
              name="message"
              placeholder="Describe your crop concern or update..."
              required
            />
            <Button type="submit" className="mt-3 rounded-full">
              <Send className="size-4" /> Send to consultant
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
