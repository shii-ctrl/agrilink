import { createFileRoute } from "@tanstack/react-router";
import { ConsultantLayout, ConsultantPageHeader } from "@/components/consultant-layout";
import { demoProductionRecords } from "@/lib/demo-data";
export const Route = createFileRoute("/consultant/production")({
  component: ConsultantProductionPage,
});
function ConsultantProductionPage() {
  return (
    <ConsultantLayout>
      <ConsultantPageHeader
        title="Farmer Production"
        description="Review farmer-member production information to provide appropriate crop guidance."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold">Production overview</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              View-only information for crop guidance; official production records are managed by
              authorized PROCY personnel.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Farmer</th>
                  <th className="px-6 py-4 font-medium">Crop</th>
                  <th className="px-6 py-4 font-medium">Planting Date</th>
                  <th className="px-6 py-4 font-medium">Expected Harvest</th>
                  <th className="px-6 py-4 font-medium">Harvested Quantity</th>
                </tr>
              </thead>
              <tbody>
                {demoProductionRecords.map((record) => (
                  <tr key={record.crop} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium">{record.farmer}</td>
                    <td className="px-6 py-4">{record.crop}</td>
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
    </ConsultantLayout>
  );
}
