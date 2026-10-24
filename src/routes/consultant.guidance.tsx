import { createFileRoute } from "@tanstack/react-router";
import { Send, Sprout } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConsultantLayout, ConsultantPageHeader } from "@/components/workspaces/consultant-layout";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  getConsultantGuidanceWorkspace,
  sendConsultantGuidanceMessage,
} from "@/services/messaging/guidance-server-functions";

export const Route = createFileRoute("/consultant/guidance")({ component: ConsultantGuidancePage });

type Workspace = Awaited<ReturnType<typeof getConsultantGuidanceWorkspace>>;

function ConsultantGuidancePage() {
  const [farmerId, setFarmerId] = useState("");
  const request = useCallback(() => getConsultantGuidanceWorkspace(), []);
  const { data: workspace, loading, error, reload } = useWorkspaceData(request);
  useEffect(() => {
    if (workspace) setFarmerId((current) => current || workspace.farmers[0]?.id || "");
  }, [workspace]);

  const selectedFarmer = workspace?.farmers.find((farmer) => farmer.id === farmerId);
  const messages = useMemo(
    () => workspace?.messages.filter((message) => message.farmerId === farmerId) ?? [],
    [farmerId, workspace],
  );

  return (
    <ConsultantLayout>
      <ConsultantPageHeader
        title="Crop Guidance"
        description="Give saved, focused guidance to the selected Farmer member."
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="Farmer guidance"
        />
        {!loading && !error && (
          <>
            <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <div className="flex items-center gap-2">
                <Sprout className="size-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Farmer guidance conversation</h2>
                  <p className="text-sm text-muted-foreground">
                    Guidance is visible only to the selected Farmer and authorized consultants.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <Label htmlFor="farmerId">Farmer</Label>
                <AppSelect
                  id="farmerId"
                  value={farmerId}
                  onValueChange={setFarmerId}
                  options={(workspace?.farmers ?? []).map((farmer) => ({
                    value: farmer.id,
                    label: farmer.name,
                  }))}
                />
              </div>
              <form
                className="mt-5"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const message = String(new FormData(form).get("message") ?? "").trim();
                  try {
                    await sendConsultantGuidanceMessage({ data: { farmerId, message } });
                    form.reset();
                    await reload();
                    toast.success(`Guidance sent to ${selectedFarmer?.name ?? "the Farmer"}.`);
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Could not send guidance.",
                    );
                  }
                }}
              >
                <Textarea
                  name="message"
                  placeholder="Write crop guidance for this Farmer..."
                  required
                />
                <Button type="submit" className="mt-3 rounded-full" disabled={!farmerId}>
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
                    <p className="text-xs text-muted-foreground">
                      {new Date(message.time).toLocaleString("en-PH")}
                    </p>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">{message.message}</p>
                </article>
              ))}
              {farmerId && messages.length === 0 && (
                <p className="rounded-3xl border border-dashed p-6 text-sm text-muted-foreground">
                  No saved guidance conversation with {selectedFarmer?.name ?? "this Farmer"} yet.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </ConsultantLayout>
  );
}
