import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";

export type CatalogProductRow = {
  id: string;
  name: string;
  cropType: string;
  description?: string | null;
  imageUrl?: string | null;
  active?: boolean;
};

export function CatalogProductTable({
  products,
  emptyMessage,
  showStatus = false,
  onReplaceImage,
  replacingImageProductId,
}: {
  products: CatalogProductRow[];
  emptyMessage: string;
  showStatus?: boolean;
  onReplaceImage?: (product: CatalogProductRow) => void;
  replacingImageProductId?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [cropType, setCropType] = useState("");
  const cropTypes = useMemo(
    () =>
      [...new Set(products.map((product) => product.cropType))].sort((a, b) => a.localeCompare(b)),
    [products],
  );
  const matchingProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const matching = products.filter(
      (product) =>
        (!cropType || product.cropType === cropType) &&
        (!query ||
          `${product.name} ${product.cropType} ${product.description ?? ""}`
            .toLocaleLowerCase()
            .includes(query)),
    );
    return matching.sort(
      (first, second) =>
        first.cropType.localeCompare(second.cropType) || first.name.localeCompare(second.name),
    );
  }, [cropType, products, search]);
  const catalogPage = usePagination(matchingProducts);
  const groupedProducts = useMemo(() => {
    return [...new Set(catalogPage.pageItems.map((product) => product.cropType))]
      .sort((a, b) => a.localeCompare(b))
      .map((type) => ({
        type,
        products: catalogPage.pageItems
          .filter((product) => product.cropType === type)
          .sort((first, second) => first.name.localeCompare(second.name)),
      }));
  }, [catalogPage.pageItems]);
  const filteredCount = matchingProducts.length;
  const columnCount = 2 + (showStatus ? 1 : 0) + (onReplaceImage ? 1 : 0);

  return (
    <>
      <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-2">
        <Input
          aria-label="Search catalog products"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search product or crop type"
        />
        <AppSelect
          ariaLabel="Filter catalog by crop type"
          value={cropType}
          onValueChange={setCropType}
          options={[
            { value: "", label: "All crop types" },
            ...cropTypes.map((type) => ({ value: type, label: type })),
          ]}
        />
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
              {onReplaceImage && <th className="px-6 py-4 font-medium">Photo</th>}
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
                  {onReplaceImage && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={`${product.name} product photo`}
                            className="size-10 rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">No photo</span>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onReplaceImage(product)}
                          disabled={replacingImageProductId === product.id}
                        >
                          {replacingImageProductId === product.id
                            ? "Saving…"
                            : product.imageUrl
                              ? "Replace"
                              : "Upload photo"}
                        </Button>
                      </div>
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
      <PaginationControls {...catalogPage} itemLabel="catalog products" />
    </>
  );
}
