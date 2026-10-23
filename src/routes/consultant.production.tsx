import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import { ConsultantLayout, ConsultantPageHeader } from "@/components/workspaces/consultant-layout";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { ProductionRecordsTable } from "@/features/operations/components/production-records-table";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { getConsultantProductionRecords } from "@/services/operations/production-server-functions";

export const Route = createFileRoute("/consultant/production")({
  component: ConsultantProductionPage,
});

function ConsultantProductionPage() {
  const request = useCallback(() => getConsultantProductionRecords(), []);
  const { data: records, loading, error, reload } = useWorkspaceData(request);

  return (
    <ConsultantLayout>
      <ConsultantPageHeader
        title="Farmer Production"
        description="Review saved Farmer production information before providing crop guidance."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="production records"
        />
        {!loading && !error && (
          <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-6 py-5">
              <h2 className="text-lg font-semibold">Production overview</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                View-only information for crop guidance; Management records official production
                data.
              </p>
            </div>
            <ProductionRecordsTable
              records={records ?? []}
              emptyMessage="No Farmer production records have been saved yet."
            />
          </section>
        )}
      </main>
    </ConsultantLayout>
  );
}
