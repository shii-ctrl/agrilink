import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FarmerLayout, FarmerPageHeader } from "@/components/farmer-layout";
import { ReceivingRecordsTable } from "@/components/receiving-records-table";
import {
  getFarmerProductStatuses,
  getFarmerReceivingRecords,
} from "@/lib/receiving-server-functions";
export const Route = createFileRoute("/farmer/receiving")({ component: FarmerReceivingPage });
function FarmerReceivingPage() {
  const [records, setRecords] = useState<Awaited<ReturnType<typeof getFarmerReceivingRecords>>>([]);
  const [statuses, setStatuses] = useState<Awaited<ReturnType<typeof getFarmerProductStatuses>>>(
    [],
  );
  useEffect(() => {
    void Promise.all([getFarmerReceivingRecords(), getFarmerProductStatuses()])
      .then(([nextRecords, nextStatuses]) => {
        setRecords(nextRecords);
        setStatuses(nextStatuses);
      })
      .catch(() => toast.error("Could not load your receiving and product status records."));
  }, []);
  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="My Receiving History"
        description="Saved PROCY delivery records for your account."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Classification</th>
                  <th className="px-6 py-4">Available</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {statuses.map((status) => (
                  <tr key={status.id} className="border-t border-border">
                    <td className="px-6 py-4 font-medium">{status.product}</td>
                    <td className="px-6 py-4">{status.classification}</td>
                    <td className="px-6 py-4">{status.availableKg} kg</td>
                    <td className="px-6 py-4 text-primary">{status.status}</td>
                  </tr>
                ))}
                {statuses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                      No delivery-backed product status yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </FarmerLayout>
  );
}
