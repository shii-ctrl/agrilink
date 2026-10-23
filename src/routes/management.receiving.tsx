import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { ReceivingRecordsTable } from "@/features/operations/components/receiving-records-table";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { getManagementReceivingRecords } from "@/services/operations/receiving-server-functions";
export const Route = createFileRoute("/management/receiving")({
  component: ManagementReceivingPage,
});
function ManagementReceivingPage() {
  const request = useCallback(() => getManagementReceivingRecords(), []);
  const { data: records, loading, error, reload } = useWorkspaceData(request);
  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Receiving"
        description="Read-only, saved farmer deliveries, classifications, and stock traceability."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="receiving records"
        />
        {!loading && !error && (
          <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-6 py-5">
              <h2 className="text-lg font-semibold">Receiving records</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Good, Semi, and Reject quantities are stored separately for each delivery.
              </p>
            </div>
            <ReceivingRecordsTable
              records={records ?? []}
              emptyMessage="No receiving records have been saved yet."
            />
          </section>
        )}
      </main>
    </ManagementLayout>
  );
}
