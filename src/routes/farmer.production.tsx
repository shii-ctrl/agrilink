import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import { FarmerLayout, FarmerPageHeader } from "@/components/workspaces/farmer-layout";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { ProductionRecordsTable } from "@/features/operations/components/production-records-table";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { getFarmerProductionRecords } from "@/services/operations/production-server-functions";

export const Route = createFileRoute("/farmer/production")({ component: FarmerProductionPage });

function FarmerProductionPage() {
  const request = useCallback(() => getFarmerProductionRecords(), []);
  const { data: records, loading, error, reload } = useWorkspaceData(request);

  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="My Production Records"
        description="Your saved planting, expected-harvest, and harvested-quantity information."
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
              <h2 className="text-lg font-semibold">My production records</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Management records official production information for your account.
              </p>
            </div>
            <ProductionRecordsTable
              records={records ?? []}
              showFarmer={false}
              emptyMessage="No production records have been saved for your account yet."
            />
          </section>
        )}
      </main>
    </FarmerLayout>
  );
}
