import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, CircleDollarSign, Eye, PackagePlus, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import { CatalogProductTable } from "@/features/marketplace/components/catalog-product-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import {
  createCatalogProduct,
  createMarketplaceListing,
  getCatalogProducts,
  getPublishableInventory,
  getMarketerMarketplaceListings,
  updateMarketplaceListingPricing,
} from "@/services/marketplace/marketplace-server-functions";
import { prepareProductImage } from "@/features/marketplace/product-image-upload";

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
  const [updatingListingPricing, setUpdatingListingPricing] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [listingQuery, setListingQuery] = useState("");
  const [listingCropType, setListingCropType] = useState("");
  const [listingClassification, setListingClassification] = useState("");
  const [listingAvailability, setListingAvailability] = useState("");
  const [inventoryId, setInventoryId] = useState("");
  const [retailPricePerKg, setRetailPricePerKg] = useState("");
  const [bundlePricePerKg, setBundlePricePerKg] = useState("");
  const [bundleMinimumKg, setBundleMinimumKg] = useState("");

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
  const visibleListings = useMemo(() => {
    const query = listingQuery.trim().toLocaleLowerCase();
    return listings
      .filter(
        (listing) =>
          (!query ||
            `${listing.name} ${listing.farmer ?? ""} ${listing.cropType} ${listing.classification}`
              .toLocaleLowerCase()
              .includes(query)) &&
          (!listingCropType || listing.cropType === listingCropType) &&
          (!listingClassification || listing.classification === listingClassification) &&
          (!listingAvailability ||
            (listingAvailability === "available"
              ? listing.quantityKg > 0
              : listing.quantityKg <= 0)),
      )
      .sort(
        (first, second) =>
          first.cropType.localeCompare(second.cropType) || first.name.localeCompare(second.name),
      );
  }, [listingAvailability, listingClassification, listingCropType, listingQuery, listings]);
  const listingCropTypes = useMemo(
    () =>
      [...new Set(listings.map((listing) => listing.cropType))].sort((a, b) => a.localeCompare(b)),
    [listings],
  );
  const hasListingFilters =
    listingQuery || listingCropType || listingClassification || listingAvailability;
  const listingsPage = usePagination(visibleListings);
  const selectedInventory = publishableInventory.find((item) => item.id === inventoryId);
  const retailPrice = Number(retailPricePerKg);
  const bundlePrice = Number(bundlePricePerKg);
  const bundleMinimum = Number(bundleMinimumKg);
  const hasValidPrices =
    retailPrice > 0 && bundlePrice > 0 && bundleMinimum > 0 && bundlePrice < retailPrice;
  const listingReady = Boolean(selectedInventory && hasValidPrices);
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
        <section className="mb-6 overflow-hidden rounded-3xl border border-primary/25 bg-card shadow-card">
          <div className="px-6 py-5 md:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              One-page listing workspace
            </p>
            <h2 className="mt-1 text-xl font-semibold">Create and manage marketplace listings</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Everything stays on this page. Add a catalog product when needed, choose available
              classified stock, set buyer prices, and review your published listings below.
            </p>
          </div>
          <div className="grid border-t border-border md:grid-cols-3">
            <a
              href="#catalog"
              className="flex gap-3 border-b border-border p-5 transition-colors hover:bg-muted/40 md:border-b-0 md:border-r"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <PackagePlus className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">Product details</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Add or find the crop you need.
                </span>
              </span>
            </a>
            <a
              href="#publish"
              className="flex gap-3 border-b border-border p-5 transition-colors hover:bg-muted/40 md:border-b-0 md:border-r"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <CircleDollarSign className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">Stock and price</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Choose stock, price it, and publish.
                </span>
              </span>
            </a>
            <a href="#listings" className="flex gap-3 p-5 transition-colors hover:bg-muted/40">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Boxes className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">Published listings</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Search, review, and update prices.
                </span>
              </span>
            </a>
          </div>
        </section>
        <div className="flex flex-col gap-6">
          <section id="listings" className="order-3 scroll-mt-6">
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold">PROCY marketplace listings</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Each quality classification remains a separate public listing and price group.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
                  <Eye className="size-3.5" /> {visibleListings.length} of {listings.length}{" "}
                  listings
                </span>
              </div>
              <div className="grid gap-3 border-b border-border p-5 md:grid-cols-2 xl:grid-cols-4">
                <Input
                  aria-label="Search marketplace listings"
                  value={listingQuery}
                  onChange={(event) => setListingQuery(event.target.value)}
                  placeholder="Search product, farmer, crop, or class"
                />
                <select
                  aria-label="Filter listings by crop type"
                  value={listingCropType}
                  onChange={(event) => setListingCropType(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All crop types</option>
                  {listingCropTypes.map((cropType) => (
                    <option key={cropType} value={cropType}>
                      {cropType}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter listings by classification"
                  value={listingClassification}
                  onChange={(event) => setListingClassification(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All classifications</option>
                  <option value="Good">Good</option>
                  <option value="Semi">Semi</option>
                  <option value="Reject">Reject</option>
                </select>
                <select
                  aria-label="Filter listings by availability"
                  value={listingAvailability}
                  onChange={(event) => setListingAvailability(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All availability</option>
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                </select>
                {hasListingFilters && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setListingQuery("");
                      setListingCropType("");
                      setListingClassification("");
                      setListingAvailability("");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
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
                    {listingsPage.pageItems.map((listing) => (
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
                    {!visibleListings.length && (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                          {listings.length
                            ? "No marketplace listings match these filters."
                            : "No marketplace listings have been created yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls {...listingsPage} itemLabel="marketplace listings" />
              {listings.length ? (
                <form
                  className="grid gap-4 border-t border-border bg-muted/20 px-6 py-5 md:grid-cols-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    setUpdatingListingPricing(true);
                    try {
                      await updateMarketplaceListingPricing({
                        data: {
                          listingId: String(formData.get("listingId")),
                          retailPricePerKg: Number(formData.get("retailPricePerKg")),
                          bundlePricePerKg: Number(formData.get("bundlePricePerKg")),
                          bundleMinimumKg: Number(formData.get("bundleMinimumKg")),
                        },
                      });
                      await load();
                      toast.success("Listing prices updated");
                    } catch (error) {
                      toast.error("Listing prices could not be updated", {
                        description: error instanceof Error ? error.message : "Please try again.",
                      });
                    } finally {
                      setUpdatingListingPricing(false);
                    }
                  }}
                >
                  <div className="space-y-2 md:col-span-4">
                    <Label htmlFor="listing-price-editor">Update an existing listing</Label>
                    <select
                      id="listing-price-editor"
                      name="listingId"
                      value={selectedListingId}
                      onChange={(event) => setSelectedListingId(event.target.value)}
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="" disabled>
                        Choose a listing
                      </option>
                      {listings.map((listing) => (
                        <option key={listing.id} value={listing.id}>
                          {listing.name} — {listing.classification}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(() => {
                    const selectedListing = listings.find(
                      (listing) => listing.id === selectedListingId,
                    );
                    const retail =
                      selectedListing?.retailPricePerKg ?? selectedListing?.pricePerKg ?? "";
                    const bundle = selectedListing?.bundlePricePerKg ?? "";
                    const minimum = selectedListing?.bundleMinimumKg ?? "";
                    return (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="existing-retail-price">Retail ₱ / kg</Label>
                          <Input
                            key={`${selectedListingId}-retail`}
                            id="existing-retail-price"
                            name="retailPricePerKg"
                            type="number"
                            min="0.01"
                            step="0.01"
                            defaultValue={retail}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="existing-bundle-price">Bundle ₱ / kg</Label>
                          <Input
                            key={`${selectedListingId}-bundle`}
                            id="existing-bundle-price"
                            name="bundlePricePerKg"
                            type="number"
                            min="0.01"
                            step="0.01"
                            defaultValue={bundle}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="existing-bundle-minimum">Bundle starts at kg</Label>
                          <Input
                            key={`${selectedListingId}-minimum`}
                            id="existing-bundle-minimum"
                            name="bundleMinimumKg"
                            type="number"
                            min="1"
                            step="0.01"
                            defaultValue={minimum}
                            required
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="submit"
                            className="w-full rounded-full"
                            disabled={!selectedListingId || updatingListingPricing}
                          >
                            {updatingListingPricing ? "Saving…" : "Save prices"}
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </form>
              ) : null}
            </section>
          </section>
          <section id="catalog" className="order-1 scroll-mt-6">
            <section className="max-w-4xl rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <PackagePlus className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Product details
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Add product to catalog</h2>
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
                <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                  <CatalogProductTable
                    products={catalogProducts}
                    emptyMessage="No products have been added to the catalog yet."
                  />
                </div>
              </div>
            </section>
          </section>
          <section id="publish" className="order-2 scroll-mt-6">
            <section className="max-w-4xl rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <PackagePlus className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Stock, pricing, and publishing
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Create PROCY marketplace listing</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use a classified product group to create a buyer-visible listing.
                  </p>
                </div>
              </div>
              <form
                className="mt-8 grid gap-5 sm:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSavingListing(true);
                  try {
                    await createMarketplaceListing({
                      data: {
                        inventoryId,
                        retailPricePerKg: retailPrice,
                        bundlePricePerKg: bundlePrice,
                        bundleMinimumKg: bundleMinimum,
                      },
                    });
                    setInventoryId("");
                    setRetailPricePerKg("");
                    setBundlePricePerKg("");
                    setBundleMinimumKg("");
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
                  <Label htmlFor="inventoryId">Choose available classified stock</Label>
                  <select
                    id="inventoryId"
                    name="inventoryId"
                    required
                    value={inventoryId}
                    onChange={(event) => setInventoryId(event.target.value)}
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
                  {publishableInventory.length === 0 ? (
                    <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                      No unused classified stock is ready yet. Record and classify a farmer delivery
                      first in{" "}
                      <Link
                        to="/marketer/receiving"
                        className="font-semibold text-primary hover:underline"
                      >
                        Product Receiving
                      </Link>
                      .
                    </p>
                  ) : selectedInventory ? (
                    <p className="rounded-xl bg-accent/60 px-3 py-2 text-sm text-accent-foreground">
                      <span className="font-semibold">Selected:</span> {selectedInventory.name} ·{" "}
                      {selectedInventory.classification} · {selectedInventory.quantityKg} kg
                      available
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Only available stock that does not already have a listing appears here.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retail-price">Retail price per kg (₱)</Label>
                  <Input
                    id="retail-price"
                    name="retailPricePerKg"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={retailPricePerKg}
                    onChange={(event) => setRetailPricePerKg(event.target.value)}
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
                    value={bundlePricePerKg}
                    onChange={(event) => setBundlePricePerKg(event.target.value)}
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
                    value={bundleMinimumKg}
                    onChange={(event) => setBundleMinimumKg(event.target.value)}
                    required
                  />
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Buyer price preview
                  </p>
                  {selectedInventory ? (
                    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
                      <p className="font-medium">
                        {selectedInventory.name} · {selectedInventory.classification} stock
                      </p>
                      {hasValidPrices ? (
                        <p className="text-sm text-primary">
                          Retail ₱{retailPrice.toFixed(2)} / kg · Bundle ₱{bundlePrice.toFixed(2)} /
                          kg for {bundleMinimum}+ kg
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Add a valid retail and lower bundle price to preview the offer.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Choose stock above to see the product buyers will receive.
                    </p>
                  )}
                </div>
                <p className="self-end text-sm text-muted-foreground">
                  Bundle price must be lower than retail. The classification is inherited from the
                  selected stock.
                </p>
                <div className="flex items-end sm:justify-end">
                  <Button
                    type="submit"
                    className="w-full rounded-full sm:w-auto"
                    disabled={savingListing || !listingReady}
                  >
                    {savingListing ? "Publishing…" : "Create listing"}
                  </Button>
                </div>
              </form>
            </section>
          </section>
        </div>
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
