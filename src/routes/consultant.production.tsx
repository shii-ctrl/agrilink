import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConsultantLayout, ConsultantPageHeader } from "@/components/consultant-layout";
import { getConsultantProductionRecords } from "@/lib/production-server-functions";

export const Route = createFileRoute("/consultant/production")({
  component: ConsultantProductionPage,
});

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

function ConsultantProductionPage() {
  const [records, setRecords] = useState<
    Awaited<ReturnType<typeof getConsultantProductionRecords>>
  >([]);

  useEffect(() => {
    void getConsultantProductionRecords()
      .then(setRecords)
      .catch(() => toast.error("Could not load saved production records."));
  }, []);

  return (
    <ConsultantLayout>
      <ConsultantPageHeader
        title="Farmer Production"
        description="Review saved Farmer production information before providing crop guidance."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold">Production overview</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              View-only information for crop guidance; Management records official production data.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Farmer</th>
                  <th className="px-6 py-4 font-medium">Crop</th>
                  <th className="px-6 py-4 font-medium">Planting date</th>
                  <th className="px-6 py-4 font-medium">Expected harvest</th>
                  <th className="px-6 py-4 font-medium">Harvested quantity</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium">{record.farmer}</td>
                    <td className="px-6 py-4">{record.product ?? "Unlinked product"}</td>
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
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                      No Farmer production records have been saved yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </ConsultantLayout>
  );
}
