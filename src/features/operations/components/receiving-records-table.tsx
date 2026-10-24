import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { Input } from "@/components/ui/input";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";

export type ReceivingClassificationRecord = {
  id: string;
  farmer: string | undefined;
  product: string;
  totalKg: string | number;
  classification: string;
  quantityKg: string | number;
  recordedAt: Date | string;
};

type Delivery = {
  id: string;
  reference: string;
  farmer: string | undefined;
  product: string;
  totalKg: number;
  goodKg: number;
  semiKg: number;
  rejectKg: number;
  recordedAt: Date | string;
};

function dateKey(value: Date | string) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function deliveryDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function groupDeliveries(records: ReceivingClassificationRecord[]): Delivery[] {
  const deliveries = new Map<string, Delivery>();
  for (const record of records) {
    const delivery = deliveries.get(record.id) ?? {
      id: record.id,
      reference: `DEL-${record.id.slice(0, 8).toUpperCase()}`,
      farmer: record.farmer,
      product: record.product,
      totalKg: Number(record.totalKg),
      goodKg: 0,
      semiKg: 0,
      rejectKg: 0,
      recordedAt: record.recordedAt,
    };
    const quantity = Number(record.quantityKg);
    if (record.classification === "Good") delivery.goodKg = quantity;
    if (record.classification === "Semi") delivery.semiKg = quantity;
    if (record.classification === "Reject") delivery.rejectKg = quantity;
    deliveries.set(record.id, delivery);
  }
  return [...deliveries.values()].sort(
    (first, second) => new Date(second.recordedAt).getTime() - new Date(first.recordedAt).getTime(),
  );
}

export function ReceivingRecordsTable({
  records,
  emptyMessage,
  showFarmer = true,
}: {
  records: ReceivingClassificationRecord[];
  emptyMessage: string;
  showFarmer?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qualityOnly, setQualityOnly] = useState(false);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const deliveries = useMemo(() => groupDeliveries(records), [records]);
  const farmers = useMemo(
    () =>
      [
        ...new Set(
          deliveries
            .map((delivery) => delivery.farmer)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [deliveries],
  );
  const products = useMemo(
    () => [...new Set(deliveries.map((delivery) => delivery.product))].sort(),
    [deliveries],
  );
  const visibleDeliveries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return deliveries.filter((delivery) => {
      const matchesSearch =
        !query ||
        [delivery.reference, delivery.farmer, delivery.product]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase().includes(query));
      return (
        matchesSearch &&
        (!selectedDate || dateKey(delivery.recordedAt) === selectedDate) &&
        (!selectedFarmer || delivery.farmer === selectedFarmer) &&
        (!selectedProduct || delivery.product === selectedProduct) &&
        (!qualityOnly || delivery.semiKg > 0 || delivery.rejectKg > 0)
      );
    });
  }, [deliveries, qualityOnly, search, selectedDate, selectedFarmer, selectedProduct]);
  const clearFilters = () => {
    setSearch("");
    setSelectedDate("");
    setSelectedFarmer("");
    setSelectedProduct("");
    setQualityOnly(false);
  };
  const hasFilters = search || selectedDate || selectedFarmer || selectedProduct || qualityOnly;
  const columnCount = showFarmer ? 8 : 7;
  const deliveriesPage = usePagination(visibleDeliveries);

  return (
    <>
      <div className="grid gap-3 border-b border-border p-5 md:grid-cols-2 xl:grid-cols-5">
        <Input
          aria-label="Search receiving records"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search farmer, product, or delivery"
          className="xl:col-span-2"
        />
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Received on
          <Input
            aria-label="Filter by delivery date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
        {showFarmer ? (
          <AppSelect
            ariaLabel="Filter by farmer"
            value={selectedFarmer}
            onValueChange={setSelectedFarmer}
            options={[
              { value: "", label: "All farmers" },
              ...farmers.map((farmer) => ({ value: farmer, label: farmer })),
            ]}
          />
        ) : (
          <div className="hidden xl:block" />
        )}
        <AppSelect
          ariaLabel="Filter by product"
          value={selectedProduct}
          onValueChange={setSelectedProduct}
          options={[
            { value: "", label: "All products" },
            ...products.map((product) => ({ value: product, label: product })),
          ]}
        />
        <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm xl:col-start-5">
          <input
            type="checkbox"
            checked={qualityOnly}
            onChange={(event) => setQualityOnly(event.target.checked)}
          />
          Quality issues only
        </label>
        {hasFilters && (
          <Button type="button" variant="outline" onClick={clearFilters} className="xl:col-start-5">
            Clear filters
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Delivery</th>
              {showFarmer && <th className="px-5 py-3">Farmer</th>}
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3 text-right">Good</th>
              <th className="px-5 py-3 text-right">Semi</th>
              <th className="px-5 py-3 text-right">Reject</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3">Received</th>
            </tr>
          </thead>
          <tbody>
            {deliveriesPage.pageItems.map((delivery) => (
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
                  {showFarmer && <td className="px-5 py-3">{delivery.farmer}</td>}
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
                  <td className="px-5 py-3 text-right font-semibold">
                    {delivery.totalKg.toFixed(2)} kg
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {deliveryDate(delivery.recordedAt)}
                  </td>
                </tr>
                {expandedDeliveryId === delivery.id && (
                  <tr className="border-t border-border bg-muted/30">
                    <td className="px-5 py-4 text-sm text-muted-foreground" colSpan={columnCount}>
                      <span className="font-medium text-foreground">Delivery details:</span>{" "}
                      {delivery.reference}
                      {showFarmer ? ` · ${delivery.farmer}` : ""} delivered{" "}
                      {delivery.totalKg.toFixed(2)} kg of {delivery.product}. Good:{" "}
                      {delivery.goodKg.toFixed(2)} kg, Semi: {delivery.semiKg.toFixed(2)} kg,
                      Reject: {delivery.rejectKg.toFixed(2)} kg.
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {visibleDeliveries.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-5 py-10 text-center text-muted-foreground">
                  {hasFilters ? "No deliveries match these filters." : emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls {...deliveriesPage} itemLabel="deliveries" />
    </>
  );
}
