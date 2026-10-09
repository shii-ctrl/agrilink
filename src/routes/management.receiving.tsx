import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ManagementLayout, ManagementPageHeader } from "@/components/management-layout";
import { ReceivingRecordsTable } from "@/components/receiving-records-table";
import { getManagementReceivingRecords } from "@/lib/receiving-server-functions";
export const Route = createFileRoute("/management/receiving")({
  component: ManagementReceivingPage,
});
function ManagementReceivingPage() {
  const [records, setRecords] = useState<Awaited<ReturnType<typeof getManagementReceivingRecords>>>(
    [],
  );
  useEffect(() => {
    void getManagementReceivingRecords()
      .then(setRecords)
      .catch(() => toast.error("Could not load saved receiving records."));
  }, []);
  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Receiving"
        description="Read-only, saved farmer deliveries, classifications, and stock traceability."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold">Receiving records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Good, Semi, and Reject quantities are stored separately for each delivery.
            </p>
          </div>
          <ReceivingRecordsTable
            records={records}
            emptyMessage="No receiving records have been saved yet."
          />
        </section>
      </main>
    </ManagementLayout>
  );
}
