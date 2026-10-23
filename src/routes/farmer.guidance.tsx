import { createFileRoute } from "@tanstack/react-router";
import { Send, Sprout } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { FarmerLayout, FarmerPageHeader } from "@/components/workspaces/farmer-layout";
import { Button } from "@/components/ui/button";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  getFarmerGuidance,
  sendFarmerGuidanceMessage,
} from "@/services/messaging/guidance-server-functions";

export const Route = createFileRoute("/farmer/guidance")({ component: FarmerGuidancePage });

function FarmerGuidancePage() {
  const request = useCallback(() => getFarmerGuidance(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const messages = data ?? [];

  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="Crop Guidance"
        description="Read saved guidance from your Farm Consultant and share production concerns."
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="guidance conversation"
        />
        {!loading && !error && (
          <>
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
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const message = String(new FormData(form).get("message") ?? "").trim();
                  try {
                    await sendFarmerGuidanceMessage({ data: { message } });
                    form.reset();
                    await reload();
                    toast.success("Guidance message sent to your Farm Consultant.");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Could not send guidance message.",
                    );
                  }
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
                    <p className="text-xs text-muted-foreground">
                      {new Date(message.time).toLocaleString("en-PH")}
                    </p>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">{message.message}</p>
                </article>
              ))}
              {messages.length === 0 && (
                <p className="rounded-3xl border border-dashed p-6 text-sm text-muted-foreground">
                  No guidance messages yet. Send your first production concern above.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </FarmerLayout>
  );
}
