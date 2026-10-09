import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MarketerLayout, MarketerPageHeader } from "@/components/marketer-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getReceivingWorkspace, recordReceivingDelivery } from "@/lib/receiving-server-functions";

export const Route = createFileRoute("/marketer/receiving")({ component: MarketerReceivingPage });
type Workspace = Awaited<ReturnType<typeof getReceivingWorkspace>>;
type ReceivingRow = Workspace["rows"][number];
type Delivery = {
  id: string;
  reference: string;
  farmer: string;
  product: string;
  totalKg: number;
  goodKg: number;
  semiKg: number;
  rejectKg: number;
  recordedAt: Date | string;
};

function dateKey(value: Date | string) {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function deliveryDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function groupDeliveries(rows: ReceivingRow[]): Delivery[] {
  const deliveries = new Map<string, Delivery>();
  for (const row of rows) {
    const current = deliveries.get(row.id) ?? {
      id: row.id,
      reference: `DEL-${row.id.slice(0, 8).toUpperCase()}`,
      farmer: row.farmer,
      product: row.product,
      totalKg: Number(row.totalKg),
      goodKg: 0,
      semiKg: 0,
      rejectKg: 0,
      recordedAt: row.recordedAt,
    };
    const quantity = Number(row.quantityKg);
    if (row.classification === "Good") current.goodKg = quantity;
    if (row.classification === "Semi") current.semiKg = quantity;
    if (row.classification === "Reject") current.rejectKg = quantity;
    deliveries.set(row.id, current);
  }
  return [...deliveries.values()].sort(
    (first, second) => new Date(second.recordedAt).getTime() - new Date(first.recordedAt).getTime(),
  );
}

function MarketerReceivingPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qualityOnly, setQualityOnly] = useState(false);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const deliveryReference = useRef(crypto.randomUUID());
  const load = () =>
    void getReceivingWorkspace()
      .then(setWorkspace)
      .catch((error) => toast.error(error.message));
  useEffect(load, []);
  const deliveries = useMemo(() => groupDeliveries(workspace?.rows ?? []), [workspace?.rows]);
  const visibleDeliveries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return deliveries.filter((delivery) => {
      const matchesSearch =
        !query ||
        [delivery.reference, delivery.farmer, delivery.product].some((value) =>
          value.toLocaleLowerCase().includes(query),
        );
      return (
        matchesSearch &&
        (!selectedDate || dateKey(delivery.recordedAt) === selectedDate) &&
        (!selectedFarmer || delivery.farmer === selectedFarmer) &&
        (!selectedProduct || delivery.product === selectedProduct) &&
        (!qualityOnly || delivery.semiKg > 0 || delivery.rejectKg > 0)
      );
    });
  }, [deliveries, qualityOnly, search, selectedDate, selectedFarmer, selectedProduct]);
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
              One row represents one delivery. Select a row to see its full classification details.
            </p>
          </div>
          <div className="grid gap-3 border-b border-border p-5 md:grid-cols-2 xl:grid-cols-5">
            <Input
              aria-label="Search receiving records"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search farmer, product, or delivery"
              className="xl:col-span-2"
            />
            <Input
              aria-label="Filter by delivery date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            <select
              aria-label="Filter by farmer"
              value={selectedFarmer}
              onChange={(event) => setSelectedFarmer(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All farmers</option>
              {workspace?.farmers.map((farmer) => (
                <option key={farmer.id} value={farmer.name}>
                  {farmer.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by product"
              value={selectedProduct}
              onChange={(event) => setSelectedProduct(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All products</option>
              {workspace?.products.map((product) => (
                <option key={product.id} value={product.name}>
                  {product.name}
                </option>
              ))}
            </select>
            <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm xl:col-start-5">
              <input
                type="checkbox"
                checked={qualityOnly}
                onChange={(event) => setQualityOnly(event.target.checked)}
              />
              Quality issues only
            </label>
            {(search || selectedDate || selectedFarmer || selectedProduct || qualityOnly) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setSelectedDate("");
                  setSelectedFarmer("");
                  setSelectedProduct("");
                  setQualityOnly(false);
                }}
                className="xl:col-start-5"
              >
                Clear filters
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Delivery</th>
                  <th className="px-5 py-3">Farmer</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3 text-right">Good</th>
                  <th className="px-5 py-3 text-right">Semi</th>
                  <th className="px-5 py-3 text-right">Reject</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Received</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeliveries.map((delivery) => (
                  <Fragment key={delivery.id}>
                    <tr
                      className="cursor-pointer border-t border-border transition-colors hover:bg-muted/40"
                      onClick={() =>
                        setExpandedDeliveryId((current) =>
                          current === delivery.id ? null : delivery.id,
                        )
                      }
                    >
                      <td className="px-5 py-3 font-medium">{delivery.reference}</td>
                      <td className="px-5 py-3">{delivery.farmer}</td>
                      <td className="px-5 py-3">{delivery.product}</td>
                      <td className="px-5 py-3 text-right text-emerald-700 dark:text-emerald-400">
                        {delivery.goodKg.toFixed(2)} kg
                      </td>
                      <td className="px-5 py-3 text-right text-amber-700 dark:text-amber-300">
                        {delivery.semiKg.toFixed(2)} kg
                      </td>
                      <td className="px-5 py-3 text-right text-red-700 dark:text-red-300">
                        {delivery.rejectKg.toFixed(2)} kg
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">{delivery.totalKg.toFixed(2)} kg</td>
                      <td className="px-5 py-3 text-muted-foreground">{deliveryDate(delivery.recordedAt)}</td>
                    </tr>
                    {expandedDeliveryId === delivery.id && (
                      <tr className="border-t border-border bg-muted/30">
                        <td className="px-5 py-4 text-sm text-muted-foreground" colSpan={8}>
                          <span className="font-medium text-foreground">Delivery details:</span> {delivery.reference} ·{" "}
                          {delivery.farmer} delivered {delivery.totalKg.toFixed(2)} kg of {delivery.product}. Good: {" "}
                          {delivery.goodKg.toFixed(2)} kg, Semi: {delivery.semiKg.toFixed(2)} kg, Reject: {" "}
                          {delivery.rejectKg.toFixed(2)} kg.
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {visibleDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                      No deliveries match these filters.
                    </td>
                  </tr>
                )}
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
            <Field name="goodKg" label="Good (kg)" />
            <Field name="semiKg" label="Semi (kg)" />
            <Field name="rejectKg" label="Reject (kg)" />
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
}: {
  label: string;
  name: string;
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
      />
    </div>
  );
}
