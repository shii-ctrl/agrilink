import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import {
  formatSellingQuantity,
  sellingUnitLabel,
  sellingUnitStep,
  type SellingUnit,
} from "@/features/marketplace/selling-units";
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
  const [productId, setProductId] = useState("");
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
  const sellingUnit =
    (workspace?.products.find((product) => product.id === productId)?.sellingUnit as SellingUnit) ??
    "kg";
  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Record Stock"
        description="Assign each delivery to its Farmer owner and permanent catalog product. Marketplace stock updates automatically."
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
            <section className="max-w-4xl rounded-3xl border border-border bg-card p-6 shadow-card">
              <div className="mb-6 grid gap-2 sm:grid-cols-3">
                {["Choose owner & product", "Distribute quality", "Save pooled stock"].map(
                  (label, index) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 text-sm font-medium"
                    >
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                        {index + 1}
                      </span>
                      {label}
                    </div>
                  ),
                )}
              </div>
              <h2 className="text-lg font-semibold">Record Farmer delivery</h2>
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
                    else toast.success("Stock recorded and marketplace totals updated.");
                    formElement.reset();
                    setTotalKg("");
                    setGoodKg("");
                    setSemiKg("");
                    setRejectKg("");
                    setProductId("");
                    deliveryReference.current = crypto.randomUUID();
                    await load();
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Unable to save delivery.",
                    );
                  }
                }}
              >
                <Select
                  label="Farmer"
                  name="farmerId"
                  options={workspace?.farmers ?? []}
                  searchable
                />
                <Select
                  label="Product"
                  name="productId"
                  options={workspace?.products ?? []}
                  value={productId}
                  onValueChange={setProductId}
                />
                <Field
                  name="totalKg"
                  label={`Total delivered (${sellingUnitLabel(sellingUnit, 2)})`}
                  value={totalKg}
                  onChange={setTotalKg}
                  sellingUnit={sellingUnit}
                />
                <Field
                  name="goodKg"
                  label={`Good (${sellingUnitLabel(sellingUnit, 2)})`}
                  value={goodKg}
                  onChange={setGoodKg}
                  sellingUnit={sellingUnit}
                />
                <Field
                  name="semiKg"
                  label={`Semi (${sellingUnitLabel(sellingUnit, 2)})`}
                  value={semiKg}
                  onChange={setSemiKg}
                  sellingUnit={sellingUnit}
                />
                <Field
                  name="rejectKg"
                  label={`Reject (${sellingUnitLabel(sellingUnit, 2)})`}
                  value={rejectKg}
                  onChange={setRejectKg}
                  sellingUnit={sellingUnit}
                />
                <div
                  className={`sm:col-span-2 rounded-2xl border p-4 text-sm ${quantitiesMatch ? "border-good/30 bg-good/10 text-good" : "border-border bg-muted/30 text-muted-foreground"}`}
                  aria-live="polite"
                >
                  <span className="font-semibold">Classification check: </span>
                  {totalValue > 0
                    ? quantitiesMatch
                      ? `Ready — Good, Semi, and Reject equal ${formatSellingQuantity(totalValue, sellingUnit)}.`
                      : `${formatSellingQuantity(classifiedKg, sellingUnit)} of ${formatSellingQuantity(totalValue, sellingUnit)} classified. ${formatSellingQuantity(Math.abs(quantityDifference), sellingUnit)} ${quantityDifference > 0 ? "still needs a classification" : "is over the delivered quantity"}.`
                    : "Enter the total delivery first, then distribute it across Good, Semi, and Reject."}
                </div>
                {totalValue > 0 ? (
                  <div className="space-y-3 rounded-2xl border border-border p-4 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold">Live quality distribution</span>
                      <span className="text-muted-foreground">
                        {Math.min(100, Math.round((classifiedKg / totalValue) * 100))}% assigned
                      </span>
                    </div>
                    <div
                      className="flex h-4 overflow-hidden rounded-full bg-muted"
                      aria-label="Quality distribution"
                    >
                      <div
                        className="bg-good transition-[width]"
                        style={{
                          width: `${Math.min(100, (Number(goodKg || 0) / totalValue) * 100)}%`,
                        }}
                        title="Good"
                      />
                      <div
                        className="bg-warning transition-[width]"
                        style={{
                          width: `${Math.min(100, (Number(semiKg || 0) / totalValue) * 100)}%`,
                        }}
                        title="Semi"
                      />
                      <div
                        className="bg-destructive transition-[width]"
                        style={{
                          width: `${Math.min(100, (Number(rejectKg || 0) / totalValue) * 100)}%`,
                        }}
                        title="Reject"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <Legend
                        color="bg-good"
                        label="Good"
                        value={Number(goodKg || 0)}
                        total={totalValue}
                        sellingUnit={sellingUnit}
                      />
                      <Legend
                        color="bg-warning"
                        label="Semi"
                        value={Number(semiKg || 0)}
                        total={totalValue}
                        sellingUnit={sellingUnit}
                      />
                      <Legend
                        color="bg-destructive"
                        label="Reject"
                        value={Number(rejectKg || 0)}
                        total={totalValue}
                        sellingUnit={sellingUnit}
                      />
                    </div>
                    <div className="flex items-start gap-2 border-t pt-3 text-sm">
                      {quantitiesMatch ? (
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-good" />
                      ) : (
                        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      )}
                      <p>
                        <span className="font-semibold">After saving:</span> Good, Semi, and Reject
                        replenish their existing marketplace offers immediately. Prices and
                        visibility will not change.
                      </p>
                    </div>
                  </div>
                ) : null}
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
function Legend({
  color,
  label,
  value,
  total,
  sellingUnit,
}: {
  color: string;
  label: string;
  value: number;
  total: number;
  sellingUnit: SellingUnit;
}) {
  return (
    <div>
      <span className={`mr-1.5 inline-block size-2 rounded-full ${color}`} />
      {label}: {formatSellingQuantity(value, sellingUnit)} ({Math.round((value / total) * 100)}%)
    </div>
  );
}
function Select({
  label,
  name,
  options,
  searchable = false,
  value: controlledValue,
  onValueChange,
}: {
  label: string;
  name: string;
  options: { id: string; name: string }[];
  searchable?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const [internalValue, setInternalValue] = useState("");
  const value = controlledValue ?? internalValue;
  const setValue = onValueChange ?? setInternalValue;

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <AppSelect
        id={name}
        name={name}
        value={value}
        onValueChange={setValue}
        onReset={() => setValue("")}
        placeholder={`Select ${label.toLowerCase()}`}
        options={options.map((option) => ({ value: option.id, label: option.name }))}
        searchable={searchable}
      />
    </div>
  );
}
function Field({
  label,
  name,
  value,
  onChange,
  sellingUnit,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  sellingUnit: SellingUnit;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        min="0"
        step={sellingUnitStep(sellingUnit)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}
