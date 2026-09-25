import { createFileRoute } from "@tanstack/react-router";
import { FarmerLayout, FarmerPageHeader } from "@/components/farmer-layout";
import { demoProductionRecords } from "@/lib/demo-data";
export const Route = createFileRoute("/farmer/production")({ component: FarmerProductionPage });
function FarmerProductionPage() {
  const records = demoProductionRecords.filter((record) => record.farmer === "Juan Dela Cruz");
  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="My Production Records"
        description="View your own recorded planting, expected-harvest, and harvested-quantity information."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold">Juan Dela Cruz’s production records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Farmer Members have view-only access to their own production records.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Crop</th>
                  <th className="px-6 py-4 font-medium">Planting Date</th>
                  <th className="px-6 py-4 font-medium">Expected Harvest</th>
                  <th className="px-6 py-4 font-medium">Harvested Quantity</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.crop} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium">{record.crop}</td>
                    <td className="px-6 py-4">{record.plantingDate}</td>
                    <td className="px-6 py-4">{record.expectedHarvest}</td>
                    <td className="px-6 py-4">{record.harvestedQuantity}</td>
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
