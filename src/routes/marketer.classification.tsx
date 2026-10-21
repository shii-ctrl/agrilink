import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { ReceivingRecordsTable } from "@/features/operations/components/receiving-records-table";
import { getReceivingWorkspace } from "@/services/operations/receiving-server-functions";

export const Route = createFileRoute("/marketer/classification")({
  head: () => ({
    meta: [
      { title: "Classification — Marketer | AgriLink" },
      { name: "description", content: "Review saved Good, Semi, and Reject delivery groups." },
    ],
  }),
  component: MarketerClassificationPage,
});

type ClassificationRow = Awaited<ReturnType<typeof getReceivingWorkspace>>["rows"][number];

function MarketerClassificationPage() {
  const [records, setRecords] = useState<ClassificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const workspace = await getReceivingWorkspace();
    setRecords(workspace.rows);
    setLoadError(null);
  }, []);
  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => void loadWorkspace(), [loadWorkspace]);
  useAutoRefresh(() => load().catch(() => undefined));

  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Classification"
        description="Saved Good, Semi, and Reject quantities from farmer deliveries. Classifications can only be created while recording a delivery."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void loadWorkspace()}
          label="classification records"
        />
        {!loading && !loadError ? (
          <>
            <div className="mb-6 flex gap-3 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <p>
                <span className="font-semibold">Inventory rule:</span> each classification is saved
                with its delivery. Only delivery-backed classified inventory can be published to the
                marketplace.
              </p>
            </div>
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex items-start gap-3 border-b border-border px-6 py-5">
                <PackageCheck className="mt-0.5 size-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Saved classification records</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    These records are stored in AgriLink and trace back to the delivery reference.
                  </p>
                </div>
              </div>
              <ReceivingRecordsTable
                records={records}
                emptyMessage="No deliveries have been recorded yet. Record a farmer delivery to create classified inventory."
              />
            </section>
          </>
        ) : null}
      </main>
    </MarketerLayout>
  );
}
