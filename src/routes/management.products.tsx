import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Eye } from "lucide-react";
import { ManagementLayout, ManagementPageHeader } from "@/components/management-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { demoMarketplaceListings } from "@/lib/demo-data";

export const Route = createFileRoute("/management/products")({
  head: () => ({
    meta: [
      { title: "Products — Management | AgriLink" },
      {
        name: "description",
        content: "Management marketplace-product monitoring interface for AgriLink.",
      },
    ],
  }),
  component: ManagementProductsPage,
});

function ManagementProductsPage() {
  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Products"
        description="Monitor marketplace listings, available quantities, and product history. Operational listings are handled by Marketers."
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <Tabs defaultValue="listings">
          <TabsList aria-label="Product monitoring sections">
            <TabsTrigger value="listings">Marketplace Listings</TabsTrigger>
            <TabsTrigger value="available">Available Products</TabsTrigger>
            <TabsTrigger value="history">Product History</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-6">
            <ProductTable
              title="Marketplace listings"
              description="Temporary classified listings published by PROCY for interface review."
            />
          </TabsContent>

          <TabsContent value="available" className="mt-6">
            <ProductTable
              title="Available products"
              description="Available quantity is based on classified quantity minus confirmed sold quantity."
            />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <section className="rounded-3xl border border-border bg-card p-10 text-center shadow-card">
              <Boxes className="mx-auto size-8 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Product history</h2>
              <p className="mt-2 text-sm text-muted-foreground">No product history is available.</p>
            </section>
          </TabsContent>
        </Tabs>

        <aside className="mt-8 flex gap-3 rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">
          <Eye className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            Management monitors products. Marketers create and maintain marketplace listings from
            classified Good, Semi, and Reject receiving records.
          </p>
        </aside>
      </main>
    </ManagementLayout>
  );
}

function ProductTable({ title, description }: { title: string; description: string }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-6 py-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-6 py-4 font-medium">Product Name</th>
              <th className="px-6 py-4 font-medium">Crop Type</th>
              <th className="px-6 py-4 font-medium">Classification</th>
              <th className="px-6 py-4 font-medium">Selling Price</th>
              <th className="px-6 py-4 font-medium">Available Quantity</th>
              <th className="px-6 py-4 font-medium">Availability</th>
              <th className="px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {demoMarketplaceListings.map((listing) => (
              <tr
                key={`${listing.product}-${listing.classification}`}
                className="border-b border-border last:border-0"
              >
                <td className="px-6 py-4 font-medium">{listing.product}</td>
                <td className="px-6 py-4 text-muted-foreground">{listing.cropType}</td>
                <td className="px-6 py-4">{listing.classification}</td>
                <td className="px-6 py-4">{listing.price}</td>
                <td className="px-6 py-4">{listing.quantity}</td>
                <td className="px-6 py-4 text-primary">{listing.availability}</td>
                <td className="px-6 py-4 text-muted-foreground">View details</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
