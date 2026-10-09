import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export type CatalogProductRow = {
  id: string;
  name: string;
  cropType: string;
  description?: string | null;
  active?: boolean;
};

export function CatalogProductTable({
  products,
  emptyMessage,
  showStatus = false,
}: {
  products: CatalogProductRow[];
  emptyMessage: string;
  showStatus?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [cropType, setCropType] = useState("");
  const cropTypes = useMemo(
    () =>
      [...new Set(products.map((product) => product.cropType))].sort((a, b) => a.localeCompare(b)),
    [products],
  );
  const groupedProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const matching = products.filter(
      (product) =>
        (!cropType || product.cropType === cropType) &&
        (!query ||
          `${product.name} ${product.cropType} ${product.description ?? ""}`
            .toLocaleLowerCase()
            .includes(query)),
    );
    return [...new Set(matching.map((product) => product.cropType))]
      .sort((a, b) => a.localeCompare(b))
      .map((type) => ({
        type,
        products: matching
          .filter((product) => product.cropType === type)
          .sort((first, second) => first.name.localeCompare(second.name)),
      }));
  }, [cropType, products, search]);
  const filteredCount = groupedProducts.reduce((count, group) => count + group.products.length, 0);
  const columnCount = showStatus ? 3 : 2;

  return (
    <>
      <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-2">
        <Input
          aria-label="Search catalog products"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search product or crop type"
        />
        <select
          aria-label="Filter catalog by crop type"
          value={cropType}
          onChange={(event) => setCropType(event.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All crop types</option>
          {cropTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Crop types and products are sorted from A to Z.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-6 py-4 font-medium">Product</th>
              <th className="px-6 py-4 font-medium">Crop type</th>
              {showStatus && <th className="px-6 py-4 font-medium">Status</th>}
            </tr>
          </thead>
          <tbody>
            {groupedProducts.flatMap((group) => [
              <tr key={`${group.type}-heading`} className="border-b border-border bg-muted/30">
                <td className="px-6 py-3 font-semibold text-primary" colSpan={columnCount}>
                  {group.type}
                </td>
              </tr>,
              ...group.products.map((product) => (
                <tr key={product.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-4 font-medium">
                    {product.name}
                    {product.description ? (
                      <p className="mt-1 text-xs font-normal text-muted-foreground">
                        {product.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{product.cropType}</td>
                  {showStatus && (
                    <td className="px-6 py-4 text-primary">
                      {product.active === false ? "Inactive" : "Active"}
                    </td>
                  )}
                </tr>
              )),
            ])}
            {filteredCount === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-6 py-10 text-center text-muted-foreground">
                  {products.length ? "No catalog products match this search." : emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
