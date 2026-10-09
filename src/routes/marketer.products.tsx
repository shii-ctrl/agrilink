import { createFileRoute } from "@tanstack/react-router";
import { Eye, PackagePlus, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MarketerLayout, MarketerPageHeader } from "@/components/marketer-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createCatalogProduct,
  createMarketplaceListing,
  getCatalogProducts,
  getPublishableInventory,
  getMarketerMarketplaceListings,
} from "@/lib/marketplace-server-functions";
import { prepareProductImage } from "@/lib/product-image-upload";

export const Route = createFileRoute("/marketer/products")({
  head: () => ({
    meta: [
      { title: "Products — Marketer | AgriLink" },
      { name: "description", content: "Manage PROCY marketplace listings in AgriLink." },
    ],
  }),
  component: MarketerProductsPage,
});

type MarketplaceListing = {
  id: string;
  name: string;
  cropType: string;
  classification: "Good" | "Semi" | "Reject";
  pricePerKg: number;
  retailPricePerKg?: number;
  bundlePricePerKg?: number | null;
  bundleMinimumKg?: number | null;
  quantityKg: number;
  description: string;
  image: string;
  farmer: string | null;
};

const cropTypes = [
  "Leafy vegetable",
  "Root vegetable",
  "Fruiting vegetable",
  "Cruciferous vegetable",
  "Legume",
  "Herb",
  "Other",
] as const;

function MarketerProductsPage() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<
    Awaited<ReturnType<typeof getCatalogProducts>>
  >([]);
  const [publishableInventory, setPublishableInventory] = useState<
    Awaited<ReturnType<typeof getPublishableInventory>>
  >([]);
  const [savingCatalogProduct, setSavingCatalogProduct] = useState(false);
  const [savingListing, setSavingListing] = useState(false);
  const [catalogImageDataUrl, setCatalogImageDataUrl] = useState("");
  const [catalogImageName, setCatalogImageName] = useState("");
  const [preparingImage, setPreparingImage] = useState(false);

  const load = async () => {
    const [nextListings, nextCatalogProducts, nextPublishableInventory] = await Promise.all([
      getMarketerMarketplaceListings(),
      getCatalogProducts(),
      getPublishableInventory(),
    ]);
    setListings(nextListings);
    setCatalogProducts(nextCatalogProducts);
    setPublishableInventory(nextPublishableInventory);
  };

  useEffect(() => {
    void load().catch(() => {
      toast.error("Could not load the product workspace. Refresh the page and try again.");
    });
  }, []);

  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Products & Marketplace Listings"
        description="Publish and manage PROCY product listings. Farmer members supply PROCY; buyers browse and order from PROCY listings only."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <span className="font-semibold">Live inventory:</span> published listings and available
          quantities are stored in AgriLink and appear in the public marketplace.
        </div>
        <Tabs defaultValue="listings">
          <TabsList aria-label="Product listing sections">
            <TabsTrigger value="listings">Marketplace Listings</TabsTrigger>
            <TabsTrigger value="catalog">Product Catalog</TabsTrigger>
            <TabsTrigger value="add">Create Listing</TabsTrigger>
          </TabsList>
          <TabsContent value="listings" className="mt-6">
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold">PROCY marketplace listings</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Each quality classification remains a separate public listing and price group.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
                  <Eye className="size-3.5" /> {listings.length} visible listings
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[930px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 font-medium">Image</th>
                      <th className="px-6 py-4 font-medium">Product</th>
                      <th className="px-6 py-4 font-medium">Farmer owner</th>
                      <th className="px-6 py-4 font-medium">Crop Type</th>
                      <th className="px-6 py-4 font-medium">Classification</th>
                      <th className="px-6 py-4 font-medium">Prices</th>
                      <th className="px-6 py-4 font-medium">Available Quantity</th>
                      <th className="px-6 py-4 font-medium">Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((listing) => (
                      <tr key={listing.id} className="border-b border-border last:border-0">
                        <td className="px-6 py-4">
                          <div className="size-10 overflow-hidden rounded-lg bg-muted">
                            {listing.image ? (
                              <img src={listing.image} alt="" className="size-full object-cover" />
                            ) : (
                              <ShoppingBag className="m-2.5 size-5 text-muted-foreground" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium">{listing.name}</td>
                        <td className="px-6 py-4">{listing.farmer ?? "Legacy / mixed stock"}</td>
                        <td className="px-6 py-4 text-muted-foreground">{listing.cropType}</td>
                        <td
                          className={`px-6 py-4 font-medium ${listing.classification === "Good" ? "text-good" : listing.classification === "Semi" ? "text-semi" : "text-reject"}`}
                        >
                          {listing.classification}
                        </td>
                        <td className="px-6 py-4">
                          <p>
                            Retail: ₱{(listing.retailPricePerKg ?? listing.pricePerKg).toFixed(2)} /
                            kg
                          </p>
                          {listing.bundlePricePerKg && listing.bundleMinimumKg ? (
                            <p className="mt-1 text-xs text-primary">
                              Bundle: ₱{listing.bundlePricePerKg.toFixed(2)} / kg ·{" "}
                              {listing.bundleMinimumKg}+ kg
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">No bundle price</p>
                          )}
                        </td>
                        <td className="px-6 py-4">{listing.quantityKg} kg</td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                            {listing.quantityKg > 0 ? "Available" : "Unavailable"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>
          <TabsContent value="catalog" className="mt-6">
            <section className="max-w-4xl rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <PackagePlus className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Add product to catalog</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a crop before recording its farmer delivery. This does not publish it to
                    buyers yet.
                  </p>
                </div>
              </div>
              <form
                className="mt-8 grid gap-5 sm:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const formData = new FormData(form);
                  setSavingCatalogProduct(true);
                  try {
                    await createCatalogProduct({
                      data: {
                        name: String(formData.get("name")),
                        cropType: String(formData.get("cropType")) as (typeof cropTypes)[number],
                        description: String(formData.get("description") ?? ""),
                        imageDataUrl: catalogImageDataUrl,
                      },
                    });
                    form.reset();
                    setCatalogImageDataUrl("");
                    setCatalogImageName("");
                    await load();
                    toast.success("Product added to catalog", {
                      description: "Next, record a farmer delivery to create classified inventory.",
                    });
                  } catch (error) {
                    toast.error("Product could not be added", {
                      description: error instanceof Error ? error.message : "Please try again.",
                    });
                  } finally {
                    setSavingCatalogProduct(false);
                  }
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="catalog-name">Product name</Label>
                  <Input id="catalog-name" name="name" minLength={2} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="catalog-crop-type">Crop type</Label>
                  <select
                    id="catalog-crop-type"
                    name="cropType"
                    required
                    defaultValue=""
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="" disabled>
                      Choose a crop type
                    </option>
                    {cropTypes.map((cropType) => (
                      <option key={cropType} value={cropType}>
                        {cropType}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="catalog-description">Description (optional)</Label>
                  <Input id="catalog-description" name="description" maxLength={2000} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="catalog-image">Product image (optional)</Label>
                  <Input
                    id="catalog-image"
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={preparingImage || savingCatalogProduct}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        setCatalogImageDataUrl("");
                        setCatalogImageName("");
                        return;
                      }
                      setPreparingImage(true);
                      void prepareProductImage(file)
                        .then((imageDataUrl) => {
                          setCatalogImageDataUrl(imageDataUrl);
                          setCatalogImageName(file.name);
                        })
                        .catch((error) => {
                          event.currentTarget.value = "";
                          setCatalogImageDataUrl("");
                          setCatalogImageName("");
                          toast.error("Image could not be selected", {
                            description:
                              error instanceof Error ? error.message : "Choose another image.",
                          });
                        })
                        .finally(() => setPreparingImage(false));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Choose a JPG, PNG, or WebP file. AgriLink prepares it for the product listing.
                  </p>
                  {catalogImageDataUrl ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
                      <img
                        src={catalogImageDataUrl}
                        alt="Selected product preview"
                        className="size-16 rounded-xl object-cover"
                      />
                      <p className="text-sm text-muted-foreground">{catalogImageName}</p>
                    </div>
                  ) : null}
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    className="rounded-full"
                    disabled={savingCatalogProduct || preparingImage}
                  >
                    {preparingImage
                      ? "Preparing image…"
                      : savingCatalogProduct
                        ? "Saving…"
                        : "Add catalog product"}
                  </Button>
                </div>
              </form>
              <div className="mt-8 border-t border-border pt-6">
                <h3 className="font-semibold">Saved catalog products</h3>
                {catalogProducts.length ? (
                  <ul className="mt-3 divide-y divide-border rounded-2xl border border-border text-sm">
                    {catalogProducts.map((product) => (
                      <li key={product.id} className="px-4 py-3">
                        <p className="font-medium">{product.name}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          {product.cropType}
                          {product.description ? ` — ${product.description}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No products have been added to the catalog yet.
                  </p>
                )}
              </div>
            </section>
          </TabsContent>
          <TabsContent value="add" className="mt-6">
            <section className="max-w-4xl rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <PackagePlus className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Create PROCY marketplace listing</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use a classified product group to create a buyer-visible listing.
                  </p>
                </div>
              </div>
              <form
                className="mt-8 grid gap-5 sm:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const formData = new FormData(form);
                  const retailPricePerKg = Number(formData.get("retailPricePerKg"));
                  const bundlePricePerKg = Number(formData.get("bundlePricePerKg"));
                  const bundleMinimumKg = Number(formData.get("bundleMinimumKg"));
                  setSavingListing(true);
                  try {
                    await createMarketplaceListing({
                      data: {
                        inventoryId: String(formData.get("inventoryId")),
                        retailPricePerKg,
                        bundlePricePerKg,
                        bundleMinimumKg,
                      },
                    });
                    form.reset();
                    await load();
                    toast.success("Marketplace listing created", {
                      description: "Published stock is now available to buyers.",
                    });
                  } catch (error) {
                    toast.error("Listing could not be created", {
                      description: error instanceof Error ? error.message : "Please try again.",
                    });
                  } finally {
                    setSavingListing(false);
                  }
                }}
              >
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="inventoryId">Delivery-backed classified inventory</Label>
                  <select
                    id="inventoryId"
                    name="inventoryId"
                    required
                    defaultValue=""
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="" disabled>
                      Select saved inventory
                    </option>
                    {publishableInventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {item.classification} ·{" "}
                        {item.farmer ?? "Legacy / mixed stock"} ({item.quantityKg} kg)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retail-price">Retail price per kg (₱)</Label>
                  <Input
                    id="retail-price"
                    name="retailPricePerKg"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bundle-price">Bundle price per kg (₱)</Label>
                  <Input
                    id="bundle-price"
                    name="bundlePricePerKg"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bundle-minimum">Bundle starts at (kg)</Label>
                  <Input
                    id="bundle-minimum"
                    name="bundleMinimumKg"
                    type="number"
                    min="1"
                    step="0.01"
                    required
                  />
                </div>
                <p className="self-end text-sm text-muted-foreground">
                  Bundle price must be lower than retail. The classification is inherited from the
                  inventory.
                </p>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    className="w-full rounded-full sm:w-auto"
                    disabled={savingListing}
                  >
                    {savingListing ? "Publishing…" : "Create listing"}
                  </Button>
                </div>
              </form>
            </section>
          </TabsContent>
        </Tabs>
        <aside className="mt-8 flex gap-3 rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">
          <ShoppingBag className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            Buyers can browse listings without signing in. Login is required before adding items to
            a cart or placing an order; no payment gateway is included.
          </p>
        </aside>
      </main>
    </MarketerLayout>
  );
}
