import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import { Button } from "@/components/ui/button";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import {
  getReceivingWorkspace,
  recordReceivingDelivery,
} from "@/services/operations/receiving-server-functions";

export const Route = createFileRoute("/marketer/receiving")({ component: MarketerReceivingPage });
type Workspace = Awaited<ReturnType<typeof getReceivingWorkspace>>;

function MarketerReceivingPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const deliveryReference = useRef(crypto.randomUUID());
  const [totalKg, setTotalKg] = useState("");
  const [goodKg, setGoodKg] = useState("");
  const [semiKg, setSemiKg] = useState("");
  const [rejectKg, setRejectKg] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const nextWorkspace = await getReceivingWorkspace();
    setWorkspace(nextWorkspace);
    setLoadError(null);
  }, []);
  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => void loadWorkspace(), [loadWorkspace]);
  useAutoRefresh(() => load().catch(() => undefined));
  const classifiedKg = Number(goodKg || 0) + Number(semiKg || 0) + Number(rejectKg || 0);
  const totalValue = Number(totalKg || 0);
  const quantitiesMatch =
    totalValue > 0 && Math.round(classifiedKg * 100) === Math.round(totalValue * 100);
  const quantityDifference = totalValue - classifiedKg;
  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Product Receiving"
        description="Record verified farmer deliveries. Classification and inventory updates are saved together in AgriLink."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void loadWorkspace()}
          label="receiving workspace"
        />
        {!loading && !loadError ? (
          <>
            <section className="max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-card">
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
                        totalKg: Number(totalKg),
                        goodKg: Number(goodKg),
                        semiKg: Number(semiKg),
                        rejectKg: Number(rejectKg),
                      },
                    });
                    if (result.duplicate) toast.message("This delivery was already recorded.");
                    else toast.success("Delivery and inventory saved.");
                    formElement.reset();
                    setTotalKg("");
                    setGoodKg("");
                    setSemiKg("");
                    setRejectKg("");
                    deliveryReference.current = crypto.randomUUID();
                    await load();
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Unable to save delivery.",
                    );
                  }
                }}
              >
                <Select label="Farmer" name="farmerId" options={workspace?.farmers ?? []} />
                <Select label="Product" name="productId" options={workspace?.products ?? []} />
                <Field
                  name="totalKg"
                  label="Total delivered (kg)"
                  value={totalKg}
                  onChange={setTotalKg}
                />
                <Field name="goodKg" label="Good (kg)" value={goodKg} onChange={setGoodKg} />
                <Field name="semiKg" label="Semi (kg)" value={semiKg} onChange={setSemiKg} />
                <Field
                  name="rejectKg"
                  label="Reject (kg)"
                  value={rejectKg}
                  onChange={setRejectKg}
                />
                <div
                  className={`sm:col-span-2 rounded-2xl border p-4 text-sm ${quantitiesMatch ? "border-good/30 bg-good/10 text-good" : "border-border bg-muted/30 text-muted-foreground"}`}
                  aria-live="polite"
                >
                  <span className="font-semibold">Classification check: </span>
                  {totalValue > 0
                    ? quantitiesMatch
                      ? `Ready — Good, Semi, and Reject equal ${totalValue.toFixed(2)} kg.`
                      : `${classifiedKg.toFixed(2)} of ${totalValue.toFixed(2)} kg classified. ${Math.abs(quantityDifference).toFixed(2)} kg ${quantityDifference > 0 ? "still needs a classification" : "is over the delivered quantity"}.`
                    : "Enter the total delivery first, then distribute it across Good, Semi, and Reject."}
                </div>
                <Button className="sm:col-span-2" type="submit" disabled={!quantitiesMatch}>
                  Save delivery
                </Button>
              </form>
            </section>
          </>
        ) : null}
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
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}
