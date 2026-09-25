import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FarmerLayout, FarmerPageHeader } from "@/components/farmer-layout";
import { getFarmerReceivingRecords } from "@/lib/receiving-server-functions";
export const Route = createFileRoute("/farmer/receiving")({ component: FarmerReceivingPage });
function FarmerReceivingPage() {
  const [records, setRecords] = useState<Awaited<ReturnType<typeof getFarmerReceivingRecords>>>([]);
  useEffect(() => {
    void getFarmerReceivingRecords().then(setRecords);
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Delivery</th>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Classification</th>
                  <th className="px-6 py-4">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={`${record.id}-${record.classification}`}
                    className="border-t border-border"
                  >
                    <td className="px-6 py-4">{record.id}</td>
                    <td className="px-6 py-4">{record.product}</td>
                    <td className="px-6 py-4">{record.totalKg} kg</td>
                    <td className="px-6 py-4">{record.classification}</td>
                    <td className="px-6 py-4">{record.quantityKg} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </FarmerLayout>
  );
}
