import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Eye } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { CatalogProductTable } from "@/features/marketplace/components/catalog-product-table";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Input } from "@/components/ui/input";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { getManagementProductWorkspace } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/management/products")({
  head: () => ({
    meta: [
      { title: "Products — Management | AgriLink" },
      { name: "description", content: "Management product monitoring for AgriLink." },
    ],
  }),
  component: ManagementProductsPage,
});

type Workspace = Awaited<ReturnType<typeof getManagementProductWorkspace>>;

function ManagementProductsPage() {
  const request = useCallback(() => getManagementProductWorkspace(), []);
  const { data: workspace, loading, error, reload } = useWorkspaceData(request);
  const availableToBuyers = useMemo(
    () =>
      (workspace?.stock ?? []).filter(
        (item) => item.listingStatus === "published" && item.availableKg > 0,
      ),
    [workspace],
  );

  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Products"
        description="Monitor catalog products, all classified stock, farmer ownership, listing state, and quantities."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="product records"
        />
        {!loading && !error && (
          <>
            <Tabs defaultValue="stock">
              <TabsList aria-label="Product monitoring sections">
                <TabsTrigger value="stock">All Classified Stock</TabsTrigger>
                <TabsTrigger value="available">Available to Buyers</TabsTrigger>
                <TabsTrigger value="catalog">Catalog</TabsTrigger>
              </TabsList>
              <TabsContent value="stock" className="mt-6">
                <StockTable
                  title="All classified stock"
                  description="Includes published, draft, unavailable, and not-yet-listed stock."
                  stock={workspace?.stock ?? []}
                />
              </TabsContent>
              <TabsContent value="available" className="mt-6">
                <StockTable
                  title="Available to buyers"
                  description="Published marketplace stock that remains available after reservations."
                  stock={availableToBuyers}
                />
              </TabsContent>
              <TabsContent value="catalog" className="mt-6">
                <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                  <div className="border-b border-border px-6 py-5">
                    <h2 className="text-lg font-semibold">Product catalog</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Every product created by Marketer, including inactive products.
                    </p>
                  </div>
                  <CatalogProductTable
                    products={workspace?.catalog ?? []}
                    showStatus
                    emptyMessage="No catalog products have been created yet."
                  />
                </section>
              </TabsContent>
            </Tabs>
            <aside className="mt-8 flex gap-3 rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">
              <Eye className="mt-0.5 size-5 shrink-0 text-primary" />
              <p>
                Management can now distinguish all classified stock from the portion that is
                actually published and available to buyers.
              </p>
            </aside>
          </>
        )}
      </main>
    </ManagementLayout>
  );
}

function StockTable({
  title,
  description,
  stock,
}: {
  title: string;
  description: string;
  stock: Workspace["stock"];
}) {
  const [query, setQuery] = useState("");
  const [cropType, setCropType] = useState("");
  const [classification, setClassification] = useState("");
  const [listingStatus, setListingStatus] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const cropTypes = useMemo(
    () => [...new Set(stock.map((item) => item.cropType))].sort((a, b) => a.localeCompare(b)),
    [stock],
  );
  const visibleStock = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return stock
      .filter((item) => {
        const matchesSearch =
          !search ||
          `${item.name} ${item.farmer ?? ""} ${item.cropType} ${item.classification} ${item.listingStatus ?? "Not listed"}`
            .toLocaleLowerCase()
            .includes(search);
        return (
          matchesSearch &&
          (!cropType || item.cropType === cropType) &&
          (!classification || item.classification === classification) &&
          (!listingStatus || (item.listingStatus ?? "Not listed") === listingStatus) &&
          (!availableOnly || item.availableKg > 0)
        );
      })
      .sort(
        (first, second) =>
          first.cropType.localeCompare(second.cropType) ||
          first.name.localeCompare(second.name) ||
          first.classification.localeCompare(second.classification),
      );
  }, [availableOnly, classification, cropType, listingStatus, query, stock]);
  const hasFilters = query || cropType || classification || listingStatus || availableOnly;
  const stockPage = usePagination(visibleStock);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-6 py-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 border-b border-border p-5 md:grid-cols-2 xl:grid-cols-5">
        <Input
          aria-label="Search stock"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search product, farmer, crop, or status"
          className="xl:col-span-2"
        />
        <AppSelect
          ariaLabel="Filter stock by crop type"
          value={cropType}
          onValueChange={setCropType}
          options={[
            { value: "", label: "All crop types" },
            ...cropTypes.map((type) => ({ value: type, label: type })),
          ]}
        />
        <AppSelect
          ariaLabel="Filter stock by classification"
          value={classification}
          onValueChange={setClassification}
          options={[
            { value: "", label: "All classifications" },
            ...["Good", "Semi", "Reject"].map((value) => ({ value, label: value })),
          ]}
        />
        <AppSelect
          ariaLabel="Filter stock by listing status"
          value={listingStatus}
          onValueChange={setListingStatus}
          options={[
            { value: "", label: "All listing states" },
            ...["published", "draft", "Not listed"].map((value) => ({ value, label: value })),
          ]}
        />
        <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm xl:col-start-4">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => setAvailableOnly(event.target.checked)}
          />
          Available only
        </label>
        {hasFilters && (
          <Button
            type="button"
            variant="outline"
            className="xl:col-start-5"
            onClick={() => {
              setQuery("");
              setCropType("");
              setClassification("");
              setListingStatus("");
              setAvailableOnly(false);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-6 py-4 font-medium">Product</th>
              <th className="px-6 py-4 font-medium">Farmer owner</th>
              <th className="px-6 py-4 font-medium">Crop type</th>
              <th className="px-6 py-4 font-medium">Classification</th>
              <th className="px-6 py-4 font-medium">Listing status</th>
              <th className="px-6 py-4 font-medium">Price</th>
              <th className="px-6 py-4 font-medium">Available</th>
            </tr>
          </thead>
          <tbody>
            {stockPage.pageItems.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-6 py-4 font-medium">{item.name}</td>
                <td className="px-6 py-4">{item.farmer ?? "Unassigned / legacy stock"}</td>
                <td className="px-6 py-4 text-muted-foreground">{item.cropType}</td>
                <td className="px-6 py-4">{item.classification}</td>
                <td className="px-6 py-4 text-primary">{item.listingStatus ?? "Not listed"}</td>
                <td className="px-6 py-4">
                  {item.pricePerKg === null ? "—" : `₱${item.pricePerKg.toFixed(2)} / kg`}
                </td>
                <td className="px-6 py-4 text-primary">{item.availableKg} kg</td>
              </tr>
            ))}
            {!visibleStock.length && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                  {stock.length
                    ? "No classified stock matches these filters."
                    : "No classified stock matches this view."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls {...stockPage} itemLabel="stock records" />
    </section>
  );
}
