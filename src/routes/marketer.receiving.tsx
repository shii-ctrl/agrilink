import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MarketerLayout, MarketerPageHeader } from "@/components/marketer-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getReceivingWorkspace, recordReceivingDelivery } from "@/lib/receiving-server-functions";

export const Route = createFileRoute("/marketer/receiving")({ component: MarketerReceivingPage });
type Workspace = Awaited<ReturnType<typeof getReceivingWorkspace>>;

function MarketerReceivingPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const deliveryReference = useRef(crypto.randomUUID());
  const load = () =>
    void getReceivingWorkspace()
      .then(setWorkspace)
      .catch((error) => toast.error(error.message));
  useEffect(load, []);
  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Product Receiving"
        description="Record verified farmer deliveries. Classification and inventory updates are saved together in AgriLink."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold">Saved receiving records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every inventory movement is linked to its delivery and the Marketer who recorded it.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Delivery</th>
                  <th className="px-5 py-3">Farmer</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {workspace?.rows.map((row) => (
                  <tr key={`${row.id}-${row.classification}`} className="border-t border-border">
                    <td className="px-5 py-3">{row.id}</td>
                    <td className="px-5 py-3">{row.farmer}</td>
                    <td className="px-5 py-3">{row.product}</td>
                    <td className="px-5 py-3">{row.classification}</td>
                    <td className="px-5 py-3">{row.quantityKg} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="mt-8 max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Record delivery</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Good + Semi + Reject must exactly equal the delivered quantity.
          </p>
          <form
            className="mt-6 grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const formElement = event.currentTarget;
              const form = new FormData(formElement);
              try {
                const result = await recordReceivingDelivery({
                  data: {
                    id: deliveryReference.current,
                    farmerId: String(form.get("farmerId")),
                    productId: String(form.get("productId")),
                    totalKg: Number(form.get("totalKg")),
                    goodKg: Number(form.get("goodKg")),
                    semiKg: Number(form.get("semiKg")),
                    rejectKg: Number(form.get("rejectKg")),
                  },
                });
                if (result.duplicate) toast.message("This delivery was already recorded.");
                else toast.success("Delivery and inventory saved.");
                formElement.reset();
                deliveryReference.current = crypto.randomUUID();
                load();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to save delivery.");
              }
            }}
          >
            <Select label="Farmer" name="farmerId" options={workspace?.farmers ?? []} />
            <Select label="Product" name="productId" options={workspace?.products ?? []} />
            <Field name="totalKg" label="Total delivered (kg)" />
            <Field name="goodKg" label="Good (kg)" defaultValue="0" />
            <Field name="semiKg" label="Semi (kg)" defaultValue="0" />
            <Field name="rejectKg" label="Reject (kg)" defaultValue="0" />
            <Button className="sm:col-span-2" type="submit">
              Save delivery
            </Button>
          </form>
        </section>
      </main>
    </MarketerLayout>
  );
}
function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        required
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        min="0"
        step="0.01"
        required
        defaultValue={defaultValue}
      />
    </div>
  );
}
