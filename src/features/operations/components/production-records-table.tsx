import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { Input } from "@/components/ui/input";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";

export type ProductionRecordRow = {
  id: string;
  farmer?: string;
  product: string | null;
  plantingDate: Date | string;
  expectedHarvestDate: Date | string;
  harvestedQuantityKg: string | number | null;
};

function dateKey(value: Date | string) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function ProductionRecordsTable({
  records,
  emptyMessage,
  showFarmer = true,
}: {
  records: ProductionRecordRow[];
  emptyMessage: string;
  showFarmer?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [plantingDate, setPlantingDate] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [unharvestedOnly, setUnharvestedOnly] = useState(false);
  const farmers = useMemo(
    () =>
      [
        ...new Set(
          records.map((record) => record.farmer).filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [records],
  );
  const products = useMemo(
    () => [...new Set(records.map((record) => record.product ?? "Unlinked product"))].sort(),
    [records],
  );
  const visibleRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return records.filter((record) => {
      const product = record.product ?? "Unlinked product";
      const matchesSearch =
        !query ||
        [record.farmer, product]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase().includes(query));
      return (
        matchesSearch &&
        (!plantingDate || dateKey(record.plantingDate) === plantingDate) &&
        (!harvestDate || dateKey(record.expectedHarvestDate) === harvestDate) &&
        (!selectedFarmer || record.farmer === selectedFarmer) &&
        (!selectedProduct || product === selectedProduct) &&
        (!unharvestedOnly || record.harvestedQuantityKg === null)
      );
    });
  }, [
    harvestDate,
    plantingDate,
    records,
    search,
    selectedFarmer,
    selectedProduct,
    unharvestedOnly,
  ]);
  const hasFilters =
    search || plantingDate || harvestDate || selectedFarmer || selectedProduct || unharvestedOnly;
  const columnCount = showFarmer ? 5 : 4;
  const clearFilters = () => {
    setSearch("");
    setPlantingDate("");
    setHarvestDate("");
    setSelectedFarmer("");
    setSelectedProduct("");
    setUnharvestedOnly(false);
  };
  const recordsPage = usePagination(visibleRecords);

  return (
    <>
      <div className="grid gap-3 border-b border-border p-5 md:grid-cols-2 xl:grid-cols-4">
        <Input
          value={search}
          aria-label="Search production records"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search farmer or crop"
        />
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Planted on
          <Input
            type="date"
            value={plantingDate}
            aria-label="Filter by planting date"
            onChange={(event) => setPlantingDate(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Expected harvest
          <Input
            type="date"
            value={harvestDate}
            aria-label="Filter by expected harvest date"
            onChange={(event) => setHarvestDate(event.target.value)}
          />
        </label>
        <AppSelect
          ariaLabel="Filter by product"
          value={selectedProduct}
          onValueChange={setSelectedProduct}
          options={[
            { value: "", label: "All crops" },
            ...products.map((product) => ({ value: product, label: product })),
          ]}
        />
        {showFarmer && (
          <AppSelect
            ariaLabel="Filter by farmer"
            value={selectedFarmer}
            onValueChange={setSelectedFarmer}
            options={[
              { value: "", label: "All farmers" },
              ...farmers.map((farmer) => ({ value: farmer, label: farmer })),
            ]}
          />
        )}
        <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
          <input
            type="checkbox"
            checked={unharvestedOnly}
            onChange={(event) => setUnharvestedOnly(event.target.checked)}
          />
          Not yet harvested
        </label>
        {hasFilters && (
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {showFarmer && <th className="px-6 py-4 font-medium">Farmer</th>}
              <th className="px-6 py-4 font-medium">Crop</th>
              <th className="px-6 py-4 font-medium">Planting date</th>
              <th className="px-6 py-4 font-medium">Expected harvest</th>
              <th className="px-6 py-4 font-medium">Harvested quantity</th>
            </tr>
          </thead>
          <tbody>
            {recordsPage.pageItems.map((record) => (
              <tr key={record.id} className="border-b border-border last:border-0">
                {showFarmer && <td className="px-6 py-4 font-medium">{record.farmer}</td>}
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
            {visibleRecords.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-6 py-10 text-center text-muted-foreground">
                  {hasFilters ? "No production records match these filters." : emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls {...recordsPage} itemLabel="production records" />
    </>
  );
}
