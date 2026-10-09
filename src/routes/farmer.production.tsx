import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FarmerLayout, FarmerPageHeader } from "@/components/farmer-layout";
import { ProductionRecordsTable } from "@/components/production-records-table";
import { getFarmerProductionRecords } from "@/lib/production-server-functions";

export const Route = createFileRoute("/farmer/production")({ component: FarmerProductionPage });

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
          <ProductionRecordsTable
            records={records}
            showFarmer={false}
            emptyMessage="No production records have been saved for your account yet."
          />
        </section>
      </main>
    </FarmerLayout>
  );
}
