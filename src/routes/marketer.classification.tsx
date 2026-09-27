import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MarketerLayout, MarketerPageHeader } from "@/components/marketer-layout";
import { getReceivingWorkspace } from "@/lib/receiving-server-functions";

export const Route = createFileRoute("/marketer/classification")({
  head: () => ({
    meta: [
      { title: "Classification — Marketer | AgriLink" },
      { name: "description", content: "Review saved Good, Semi, and Reject delivery groups." },
    ],
  }),
  component: MarketerClassificationPage,
});

type ClassificationRow = Awaited<ReturnType<typeof getReceivingWorkspace>>["rows"][number];

function MarketerClassificationPage() {
  const [records, setRecords] = useState<ClassificationRow[]>([]);

  useEffect(() => {
    void getReceivingWorkspace()
      .then((workspace) => setRecords(workspace.rows))
      .catch(() => toast.error("Could not load saved classifications."));
  }, []);

  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Classification"
        description="Saved Good, Semi, and Reject quantities from farmer deliveries. Classifications can only be created while recording a delivery."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 flex gap-3 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>
            <span className="font-semibold">Inventory rule:</span> each classification is saved with
            its delivery. Only delivery-backed classified inventory can be published to the
            marketplace.
          </p>
        </div>
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="flex items-start gap-3 border-b border-border px-6 py-5">
            <PackageCheck className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Saved classification records</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These records are stored in AgriLink and trace back to the delivery reference.
              </p>
            </div>
          </div>
          {records.length === 0 ? (
            <p className="px-6 py-10 text-sm text-muted-foreground">
              No deliveries have been recorded yet. Record a farmer delivery to create classified
              inventory.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-medium">Delivery</th>
                    <th className="px-6 py-4 font-medium">Farmer</th>
                    <th className="px-6 py-4 font-medium">Product</th>
                    <th className="px-6 py-4 font-medium">Classification</th>
                    <th className="px-6 py-4 font-medium">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={`${record.id}-${record.classification}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-6 py-4 font-medium">{record.id}</td>
                      <td className="px-6 py-4">{record.farmer}</td>
                      <td className="px-6 py-4">{record.product}</td>
                      <td
                        className={`px-6 py-4 font-medium ${
                          record.classification === "Good"
                            ? "text-good"
                            : record.classification === "Semi"
                              ? "text-semi"
                              : "text-reject"
                        }`}
                      >
                        {record.classification}
                      </td>
                      <td className="px-6 py-4">{record.quantityKg} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </MarketerLayout>
  );
}
