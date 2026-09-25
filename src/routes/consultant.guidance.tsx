import { createFileRoute } from "@tanstack/react-router";
import { Send, Sprout } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConsultantLayout, ConsultantPageHeader } from "@/components/consultant-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendDemoNotification } from "@/lib/demo-notifications";
export const Route = createFileRoute("/consultant/guidance")({ component: ConsultantGuidancePage });
const initial = [
  {
    id: "consult-1",
    author: "Juan Dela Cruz",
    role: "Farmer Member",
    time: "Today, 10:05 AM",
    message: "My tomato plants need monitoring. Please advise what I should observe this week.",
  },
];
function ConsultantGuidancePage() {
  const [messages, setMessages] = useState(initial);
  return (
    <ConsultantLayout>
      <ConsultantPageHeader
        title="Crop Guidance"
        description="Give focused crop guidance to individual farmer members based on their production concerns."
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <Sprout className="size-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Juan Dela Cruz</h2>
              <p className="text-sm text-muted-foreground">
                Farmer Member · focused guidance conversation
              </p>
            </div>
          </div>
          <form
            className="mt-5"
            onSubmit={(event) => {
              event.preventDefault();
              const message = String(new FormData(event.currentTarget).get("message") ?? "").trim();
              if (!message) return;
              setMessages((current) => [
                ...current,
                {
                  id: `consultant-${Date.now()}`,
                  author: "Ana Garcia",
                  role: "Farm Consultant",
                  time: "Just now",
                  message,
                },
              ]);
              sendDemoNotification({
                role: "Farmer",
                title: "New crop guidance",
                message: `Ana Garcia: ${message}`,
                target: "/farmer/guidance",
              });
              event.currentTarget.reset();
              toast("Temporary crop guidance sent");
            }}
          >
            <Textarea
              name="message"
              placeholder="Write crop guidance for this farmer..."
              required
            />
            <Button type="submit" className="mt-3 rounded-full">
              <Send className="size-4" /> Send guidance
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
