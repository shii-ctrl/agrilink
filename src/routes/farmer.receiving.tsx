import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { FarmerLayout, FarmerPageHeader } from "@/components/workspaces/farmer-layout";
import { ReceivingRecordsTable } from "@/features/operations/components/receiving-records-table";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { ResponsiveFilterPanel } from "@/components/data/responsive-filter-panel";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  getFarmerProductStatuses,
  getFarmerReceivingRecords,
} from "@/services/operations/receiving-server-functions";
export const Route = createFileRoute("/farmer/receiving")({ component: FarmerReceivingPage });
function FarmerReceivingPage() {
  const [statusQuery, setStatusQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const request = useCallback(async () => {
    const [records, statuses] = await Promise.all([
      getFarmerReceivingRecords(),
      getFarmerProductStatuses(),
    ]);
    return { records, statuses };
  }, []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const records = data?.records ?? [];
  const statuses = data?.statuses ?? [];
  const visibleStatuses = statuses.filter(
    (status) =>
      `${status.product} ${status.classification} ${status.status}`
        .toLocaleLowerCase()
        .includes(statusQuery.trim().toLocaleLowerCase()) &&
      (!statusFilter || status.status === statusFilter),
  );
  const statusesPage = usePagination(visibleStatuses);
  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="My Receiving History"
        description="Saved PROCY delivery records for your account."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="receiving history"
        />
        {!loading && !error && (
          <>
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-6 py-5">
                <h2 className="text-lg font-semibold">Delivered products</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Receiving and classifications are recorded by authorized PROCY personnel.
                </p>
              </div>
              <ReceivingRecordsTable
                records={records}
                showFarmer={false}
                emptyMessage="No deliveries have been recorded for your account yet."
              />
            </section>
            <section className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-6 py-5">
                <h2 className="text-lg font-semibold">My product status</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your classified stock, available quantity, and marketplace status.
                </p>
              </div>
              <ResponsiveFilterPanel
                activeCount={[statusQuery, statusFilter].filter(Boolean).length}
                contentClassName="md:grid-cols-2"
              >
                <Input
                  aria-label="Search product status"
                  value={statusQuery}
                  onChange={(event) => setStatusQuery(event.target.value)}
                  placeholder="Search product, classification, or status"
                />
                <AppSelect
                  ariaLabel="Filter product status"
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  options={[
                    { value: "", label: "All availability states" },
                    ...[...new Set(statuses.map((status) => status.status))]
                      .sort()
                      .map((status) => ({ value: status, label: status })),
                  ]}
                />
              </ResponsiveFilterPanel>
              <div className="overflow-x-auto md:overflow-visible">
                <table data-responsive-table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4">Product</th>
                      <th className="px-6 py-4">Classification</th>
                      <th className="px-6 py-4">Available</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusesPage.pageItems.map((status) => (
                      <tr key={status.id} className="border-t border-border">
                        <td data-label="Product" className="px-6 py-4 font-medium">
                          {status.product}
                        </td>
                        <td data-label="Classification" className="px-6 py-4">
                          {status.classification}
                        </td>
                        <td data-label="Available" className="px-6 py-4">
                          {status.availableKg} kg
                        </td>
                        <td data-label="Status" className="px-6 py-4 text-primary">
                          {status.status}
                        </td>
                      </tr>
                    ))}
                    {visibleStatuses.length === 0 && (
                      <tr>
                        <td
                          data-mobile-full
                          colSpan={4}
                          className="px-6 py-8 text-center text-muted-foreground"
                        >
                          {statuses.length
                            ? "No product status records match these filters."
                            : "No delivery-backed product status yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls {...statusesPage} itemLabel="product-status records" />
            </section>
          </>
        )}
      </main>
    </FarmerLayout>
  );
}
