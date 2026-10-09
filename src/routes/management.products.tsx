import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ManagementLayout, ManagementPageHeader } from "@/components/management-layout";
import { CatalogProductTable } from "@/components/catalog-product-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getManagementProductWorkspace } from "@/lib/marketplace-server-functions";

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
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  useEffect(() => {
    void getManagementProductWorkspace()
      .then(setWorkspace)
      .catch(() => toast.error("Could not load saved product records."));
  }, []);
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
            Management can now distinguish all classified stock from the portion that is actually
            published and available to buyers.
          </p>
        </aside>
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
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-6 py-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
            {stock.map((item) => (
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
            {!stock.length && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                  No classified stock matches this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
