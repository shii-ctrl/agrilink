import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FarmerLayout, FarmerPageHeader } from "@/components/farmer-layout";
import { getFarmerProductionRecords } from "@/lib/production-server-functions";

export const Route = createFileRoute("/farmer/production")({ component: FarmerProductionPage });

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

function FarmerProductionPage() {
  const [records, setRecords] = useState<Awaited<ReturnType<typeof getFarmerProductionRecords>>>(
    [],
  );

  useEffect(() => {
    void getFarmerProductionRecords()
      .then(setRecords)
      .catch(() => toast.error("Could not load your production records."));
  }, []);

  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="My Production Records"
        description="Your saved planting, expected-harvest, and harvested-quantity information."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold">My production records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Management records official production information for your account.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Crop</th>
                  <th className="px-6 py-4 font-medium">Planting date</th>
                  <th className="px-6 py-4 font-medium">Expected harvest</th>
                  <th className="px-6 py-4 font-medium">Harvested quantity</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium">
                      {record.product ?? "Unlinked product"}
                    </td>
                    <td className="px-6 py-4">{formatDate(record.plantingDate)}</td>
                    <td className="px-6 py-4">{formatDate(record.expectedHarvestDate)}</td>
                    <td className="px-6 py-4">
                      {record.harvestedQuantityKg === null
                        ? "Not yet harvested"
                        : `${record.harvestedQuantityKg} kg`}
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                      No production records have been saved for your account yet.
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
