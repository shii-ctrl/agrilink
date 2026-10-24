import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  Boxes,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  PackagePlus,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import { CatalogProductTable } from "@/features/marketplace/components/catalog-product-table";
import { procyMarketCategories } from "@/features/marketplace/procy-market-categories";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import {
  createCatalogProduct,
  createMarketplaceListing,
  getCatalogProducts,
  getPublishableInventory,
  getMarketerMarketplaceListings,
  setMarketplaceListingStatus,
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
  component: AddProductPage,
});

export type ProductWorkspaceView = "catalog" | "publish" | "listings";

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
  status: "draft" | "published" | "unavailable" | "archived";
};

const cropTypes = procyMarketCategories;
const workspacePageCopy: Record<ProductWorkspaceView, { title: string; description: string }> = {
  catalog: {
    title: "Add Product",
    description: "Add a crop to the catalog before recording a farmer delivery.",
  },
  publish: {
    title: "Price & Publish",
    description: "Choose classified stock, set the buyer price, then save or publish the listing.",
  },
  listings: {
    title: "Published Listings",
    description: "Review, update, publish, or archive your PROCY marketplace listings.",
  },
};

function AddProductPage() {
  return <MarketerProductsPage view="catalog" />;
}

export function MarketerProductsPage({ view }: { view: ProductWorkspaceView }) {
  const pageCopy = workspacePageCopy[view];
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
  const [catalogCropType, setCatalogCropType] = useState("");
  const [preparingImage, setPreparingImage] = useState(false);
  const [updatingListingPricing, setUpdatingListingPricing] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [listingQuery, setListingQuery] = useState("");
  const [listingCropType, setListingCropType] = useState("");
  const [listingClassification, setListingClassification] = useState("");
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const [listingAvailability, setListingAvailability] = useState("");
  const [listingStatus, setListingStatus] = useState("");
  const [inventoryId, setInventoryId] = useState("");
  const [stockPickerOpen, setStockPickerOpen] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [expandedCropTypes, setExpandedCropTypes] = useState<string[]>([]);
  const [expandedStockGroups, setExpandedStockGroups] = useState<string[]>([]);
  const [retailPricePerKg, setRetailPricePerKg] = useState("");
  const [bundlePricePerKg, setBundlePricePerKg] = useState("");
  const [bundleMinimumKg, setBundleMinimumKg] = useState("");
  const [newListingStatus, setNewListingStatus] = useState<"draft" | "published">("draft");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextListings, nextCatalogProducts, nextPublishableInventory] = await Promise.all([
      getMarketerMarketplaceListings(),
      getCatalogProducts(),
      getPublishableInventory(),
    ]);
    setListings(nextListings);
    setCatalogProducts(nextCatalogProducts);
    setPublishableInventory(nextPublishableInventory);
    setLoadError(null);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => void loadWorkspace(), [loadWorkspace]);
  useAutoRefresh(() => load().catch(() => undefined));
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
          (!listingStatus || listing.status === listingStatus) &&
          (!listingAvailability ||
            (listingAvailability === "available"
              ? listing.quantityKg > 0
              : listing.quantityKg <= 0)),
      )
      .sort(
        (first, second) =>
          first.cropType.localeCompare(second.cropType) || first.name.localeCompare(second.name),
      );
  }, [
    listingAvailability,
    listingClassification,
    listingCropType,
    listingQuery,
    listingStatus,
    listings,
  ]);
  const listingCropTypes = useMemo(
    () =>
      [...new Set(listings.map((listing) => listing.cropType))].sort((a, b) => a.localeCompare(b)),
    [listings],
  );
  const hasListingFilters =
    listingQuery ||
    listingCropType ||
    listingClassification ||
    listingAvailability ||
    listingStatus;
  const listingsPage = usePagination(visibleListings);
  const selectedInventory = publishableInventory.find((item) => item.id === inventoryId);
  const normalizedStockSearch = stockSearch.trim().toLocaleLowerCase();
  const inventoryByCropType = useMemo(() => {
    const stockByCropType = new Map<string, typeof publishableInventory>();

    for (const item of publishableInventory) {
      if (
        normalizedStockSearch &&
        !`${item.name} ${item.cropType} ${item.classification} ${item.farmer ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedStockSearch)
      ) {
        continue;
      }

      const cropStock = stockByCropType.get(item.cropType) ?? [];
      cropStock.push(item);
      stockByCropType.set(item.cropType, cropStock);
    }

    return [...stockByCropType.entries()]
      .sort(([firstCrop], [secondCrop]) => firstCrop.localeCompare(secondCrop))
      .map(([cropType, cropStock]) => ({
        cropType,
        classifications: (["Good", "Semi", "Reject"] as const)
          .map((classification) => ({
            classification,
            items: cropStock
              .filter((item) => item.classification === classification)
              .sort(
                (first, second) =>
                  first.name.localeCompare(second.name) ||
                  (first.farmer ?? "").localeCompare(second.farmer ?? ""),
              ),
          }))
          .filter(({ items }) => items.length > 0),
      }))
      .filter(({ classifications }) => classifications.length > 0);
  }, [normalizedStockSearch, publishableInventory]);
  const retailPrice = Number(retailPricePerKg);
  const bundlePrice = Number(bundlePricePerKg);
  const bundleMinimum = Number(bundleMinimumKg);
  const hasBundleInput = bundlePricePerKg !== "" || bundleMinimumKg !== "";
  const hasValidPrices =
    retailPrice > 0 &&
    (!hasBundleInput || (bundlePrice > 0 && bundleMinimum > 0 && bundlePrice < retailPrice));
  const listingReady = Boolean(selectedInventory && hasValidPrices);
  return (
    <MarketerLayout>
      {confirmationDialog}
      <MarketerPageHeader title={pageCopy.title} description={pageCopy.description} />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void loadWorkspace()}
          label="product workspace"
        />
        {!loading && !loadError ? (
          <>
            <div className="flex flex-col gap-6">
              {view === "listings" ? (
                <section id="listings" className="scroll-mt-6">
                  <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
                      <div>
                        <h2 className="text-lg font-semibold">PROCY marketplace listings</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Each quality classification remains a separate public listing and price
                          group.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
                        <Eye className="size-3.5" /> {visibleListings.length} of {listings.length}{" "}
                        listings
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => void load()}
                      >
                        <RefreshCw className="size-3.5" /> Refresh
                      </Button>
                    </div>
                    <div className="grid gap-3 border-b border-border p-5 md:grid-cols-2 xl:grid-cols-5">
                      <Input
                        aria-label="Search marketplace listings"
                        value={listingQuery}
                        onChange={(event) => setListingQuery(event.target.value)}
                        placeholder="Search product, farmer, crop, or class"
                      />
                      <AppSelect
                        ariaLabel="Filter listings by crop type"
                        value={listingCropType}
                        onValueChange={setListingCropType}
                        options={[
                          { value: "", label: "All crop types" },
                          ...listingCropTypes.map((cropType) => ({
                            value: cropType,
                            label: cropType,
                          })),
                        ]}
                      />
                      <AppSelect
                        ariaLabel="Filter listings by visibility"
                        value={listingStatus}
                        onValueChange={setListingStatus}
                        options={[
                          { value: "", label: "All listing states" },
                          { value: "draft", label: "Draft" },
                          { value: "published", label: "Published" },
                          { value: "archived", label: "Archived" },
                        ]}
                      />
                      <AppSelect
                        ariaLabel="Filter listings by classification"
                        value={listingClassification}
                        onValueChange={setListingClassification}
                        options={[
                          { value: "", label: "All classifications" },
                          { value: "Good", label: "Good" },
                          { value: "Semi", label: "Semi" },
                          { value: "Reject", label: "Reject" },
                        ]}
                      />
                      <AppSelect
                        ariaLabel="Filter listings by availability"
                        value={listingAvailability}
                        onValueChange={setListingAvailability}
                        options={[
                          { value: "", label: "All availability" },
                          { value: "available", label: "Available" },
                          { value: "unavailable", label: "Unavailable" },
                        ]}
                      />
                      {hasListingFilters && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setListingQuery("");
                            setListingCropType("");
                            setListingClassification("");
                            setListingAvailability("");
                            setListingStatus("");
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
                            <th className="px-6 py-4 font-medium">Listing state</th>
                            <th className="px-6 py-4 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {listingsPage.pageItems.map((listing) => (
                            <tr key={listing.id} className="border-b border-border last:border-0">
                              <td className="px-6 py-4">
                                <div className="size-10 overflow-hidden rounded-lg bg-muted">
                                  {listing.image ? (
                                    <img
                                      src={listing.image}
                                      alt=""
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    <ShoppingBag className="m-2.5 size-5 text-muted-foreground" />
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 font-medium">{listing.name}</td>
                              <td className="px-6 py-4">
                                {listing.farmer ?? "Legacy / mixed stock"}
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">
                                {listing.cropType}
                              </td>
                              <td
                                className={`px-6 py-4 font-medium ${listing.classification === "Good" ? "text-good" : listing.classification === "Semi" ? "text-semi" : "text-reject"}`}
                              >
                                {listing.classification}
                              </td>
                              <td className="px-6 py-4">
                                <p>
                                  Retail: ₱
                                  {(listing.retailPricePerKg ?? listing.pricePerKg).toFixed(2)} / kg
                                </p>
                                {listing.bundlePricePerKg && listing.bundleMinimumKg ? (
                                  <p className="mt-1 text-xs text-primary">
                                    Bundle: ₱{listing.bundlePricePerKg.toFixed(2)} / kg ·{" "}
                                    {listing.bundleMinimumKg}+ kg
                                  </p>
                                ) : (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    No bundle price
                                  </p>
                                )}
                              </td>
                              <td className="px-6 py-4">{listing.quantityKg} kg</td>
                              <td className="px-6 py-4">
                                <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                                  {listing.quantityKg > 0 ? "Available" : "Unavailable"}
                                </span>
                              </td>
                              <td className="px-6 py-4 capitalize">{listing.status}</td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-2">
                                  {listing.status !== "published" &&
                                  listing.status !== "archived" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="rounded-full"
                                      onClick={async () => {
                                        try {
                                          await setMarketplaceListingStatus({
                                            data: { listingId: listing.id, status: "published" },
                                          });
                                          await load();
                                          toast.success("Listing published to buyers.");
                                        } catch (error) {
                                          toast.error("Listing could not be published", {
                                            description:
                                              error instanceof Error
                                                ? error.message
                                                : "Please try again.",
                                          });
                                        }
                                      }}
                                    >
                                      <Eye className="size-3.5" /> Publish
                                    </Button>
                                  ) : null}
                                  {listing.status === "published" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="rounded-full"
                                      onClick={async () => {
                                        try {
                                          await setMarketplaceListingStatus({
                                            data: { listingId: listing.id, status: "draft" },
                                          });
                                          await load();
                                          toast.success(
                                            "Listing returned to draft. Buyers can no longer see it.",
                                          );
                                        } catch (error) {
                                          toast.error("Listing could not be unpublished", {
                                            description:
                                              error instanceof Error
                                                ? error.message
                                                : "Please try again.",
                                          });
                                        }
                                      }}
                                    >
                                      <EyeOff className="size-3.5" /> Unpublish
                                    </Button>
                                  ) : null}
                                  {listing.status !== "archived" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="rounded-full"
                                      onClick={async () => {
                                        if (
                                          !(await requestConfirmation({
                                            title: `Archive ${listing.name}?`,
                                            description:
                                              "It will stay in your records, but buyers will no longer see it.",
                                            confirmLabel: "Archive listing",
                                            destructive: true,
                                          }))
                                        )
                                          return;
                                        try {
                                          await setMarketplaceListingStatus({
                                            data: { listingId: listing.id, status: "archived" },
                                          });
                                          await load();
                                          toast.success("Listing archived.");
                                        } catch (error) {
                                          toast.error("Listing could not be archived", {
                                            description:
                                              error instanceof Error
                                                ? error.message
                                                : "Please try again.",
                                          });
                                        }
                                      }}
                                    >
                                      <Archive className="size-3.5" /> Archive
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="rounded-full"
                                      onClick={async () => {
                                        try {
                                          await setMarketplaceListingStatus({
                                            data: { listingId: listing.id, status: "draft" },
                                          });
                                          await load();
                                          toast.success("Listing restored as a draft.");
                                        } catch (error) {
                                          toast.error("Listing could not be restored", {
                                            description:
                                              error instanceof Error
                                                ? error.message
                                                : "Please try again.",
                                          });
                                        }
                                      }}
                                    >
                                      Restore draft
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!visibleListings.length && (
                            <tr>
                              <td
                                colSpan={10}
                                className="px-6 py-10 text-center text-muted-foreground"
                              >
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
                                bundlePricePerKg: optionalNumber(formData.get("bundlePricePerKg")),
                                bundleMinimumKg: optionalNumber(formData.get("bundleMinimumKg")),
                              },
                            });
                            await load();
                            toast.success("Listing prices updated");
                          } catch (error) {
                            toast.error("Listing prices could not be updated", {
                              description:
                                error instanceof Error ? error.message : "Please try again.",
                            });
                          } finally {
                            setUpdatingListingPricing(false);
                          }
                        }}
                      >
                        <div className="space-y-2 md:col-span-4">
                          <Label htmlFor="listing-price-editor">Update an existing listing</Label>
                          <AppSelect
                            id="listing-price-editor"
                            name="listingId"
                            value={selectedListingId}
                            onValueChange={setSelectedListingId}
                            placeholder="Choose a listing"
                            options={listings.map((listing) => ({
                              value: listing.id,
                              label: `${listing.name} — ${listing.classification}`,
                              description: `${listing.cropType} · ${listing.quantityKg} kg available`,
                            }))}
                          />
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
              ) : null}
              {view === "catalog" ? (
                <section id="catalog" className="scroll-mt-6">
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
                          Add a crop before recording its farmer delivery. This does not publish it
                          to buyers yet.
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
                              cropType: String(
                                formData.get("cropType"),
                              ) as (typeof cropTypes)[number],
                              description: String(formData.get("description") ?? ""),
                              imageDataUrl: catalogImageDataUrl,
                            },
                          });
                          form.reset();
                          setCatalogImageDataUrl("");
                          setCatalogImageName("");
                          setCatalogCropType("");
                          await load();
                          toast.success("Product added to catalog", {
                            description:
                              "Next, open Product Receiving to record a farmer delivery.",
                          });
                        } catch (error) {
                          toast.error("Product could not be added", {
                            description:
                              error instanceof Error ? error.message : "Please try again.",
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
                        <AppSelect
                          id="catalog-crop-type"
                          name="cropType"
                          value={catalogCropType}
                          onValueChange={setCatalogCropType}
                          placeholder="Choose a crop type"
                          options={cropTypes.map((cropType) => ({
                            value: cropType,
                            label: cropType,
                          }))}
                        />
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
                                    error instanceof Error
                                      ? error.message
                                      : "Choose another image.",
                                });
                              })
                              .finally(() => setPreparingImage(false));
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Choose a JPG, PNG, or WebP file. AgriLink prepares it for the product
                          listing.
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
              ) : null}
              {view === "publish" ? (
                <section id="publish" className="scroll-mt-6">
                  <section className="max-w-4xl rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                        <PackagePlus className="size-5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                          Stock, pricing, and publishing
                        </p>
                        <h2 className="mt-1 text-lg font-semibold">
                          Create PROCY marketplace listing
                        </h2>
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
                              bundlePricePerKg: hasBundleInput ? bundlePrice : null,
                              bundleMinimumKg: hasBundleInput ? bundleMinimum : null,
                              status: newListingStatus,
                            },
                          });
                          setInventoryId("");
                          setRetailPricePerKg("");
                          setBundlePricePerKg("");
                          setBundleMinimumKg("");
                          await load();
                          toast.success(
                            newListingStatus === "published"
                              ? "Marketplace listing published"
                              : "Listing saved as a draft",
                            {
                              description:
                                newListingStatus === "published"
                                  ? "Published stock is now available to buyers."
                                  : "Review it below, then publish when you are ready.",
                            },
                          );
                        } catch (error) {
                          toast.error("Listing could not be created", {
                            description:
                              error instanceof Error ? error.message : "Please try again.",
                          });
                        } finally {
                          setSavingListing(false);
                        }
                      }}
                    >
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="inventoryId">Choose available classified stock</Label>
                        <input name="inventoryId" type="hidden" value={inventoryId} />
                        <Popover
                          open={stockPickerOpen}
                          onOpenChange={(open) => {
                            setStockPickerOpen(open);
                            if (!open) setStockSearch("");
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              id="inventoryId"
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={stockPickerOpen}
                              aria-haspopup="dialog"
                              disabled={publishableInventory.length === 0}
                              className="h-auto min-h-12 w-full justify-between rounded-xl px-4 py-3 text-left font-normal"
                            >
                              {selectedInventory ? (
                                <span className="flex min-w-0 flex-col gap-1">
                                  <span className="truncate font-semibold">
                                    {selectedInventory.name}
                                  </span>
                                  <span className="truncate text-xs text-muted-foreground">
                                    {selectedInventory.cropType} ·{" "}
                                    {selectedInventory.classification} ·{" "}
                                    {selectedInventory.quantityKg} kg ·{" "}
                                    {selectedInventory.farmer ?? "Legacy / mixed stock"}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Choose available stock
                                </span>
                              )}
                              <ChevronDown className="ml-3 size-4 shrink-0 text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            sideOffset={8}
                            className="w-[min(92vw,46rem)] max-h-[min(68vh,42rem)] overflow-y-auto p-0"
                          >
                            <div className="sticky top-0 z-10 border-b border-border bg-popover px-5 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <h3 className="font-semibold">Available stock</h3>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Search, then open only the crop and quality you need.
                                  </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                  {publishableInventory.length} stocks
                                </span>
                              </div>
                              <Label htmlFor="stock-search" className="sr-only">
                                Search available stock
                              </Label>
                              <Input
                                id="stock-search"
                                autoFocus
                                value={stockSearch}
                                onChange={(event) => setStockSearch(event.target.value)}
                                placeholder="Search product, crop type, farmer, or quality"
                                className="mt-4"
                              />
                            </div>
                            <div className="space-y-5 p-5">
                              {inventoryByCropType.length === 0 ? (
                                <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
                                  No available stock matches that search.
                                </p>
                              ) : (
                                inventoryByCropType.map(({ cropType, classifications }) => {
                                  const cropIsOpen =
                                    Boolean(normalizedStockSearch) ||
                                    expandedCropTypes.includes(cropType);
                                  const cropStockCount = classifications.reduce(
                                    (total, group) => total + group.items.length,
                                    0,
                                  );

                                  return (
                                    <section
                                      key={cropType}
                                      className="overflow-hidden rounded-2xl border border-border"
                                    >
                                      <button
                                        type="button"
                                        aria-expanded={cropIsOpen}
                                        onClick={() =>
                                          setExpandedCropTypes((current) =>
                                            current.includes(cropType)
                                              ? current.filter((item) => item !== cropType)
                                              : [...current, cropType],
                                          )
                                        }
                                        className="flex w-full items-center justify-between gap-3 bg-muted/30 px-4 py-3 text-left hover:bg-muted/50"
                                      >
                                        <span>
                                          <span className="block text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                                            {cropType}
                                          </span>
                                          <span className="mt-1 block text-xs text-muted-foreground">
                                            {cropStockCount} available{" "}
                                            {cropStockCount === 1 ? "stock" : "stocks"}
                                          </span>
                                        </span>
                                        <ChevronDown
                                          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                                            cropIsOpen ? "rotate-180" : ""
                                          }`}
                                        />
                                      </button>
                                      {cropIsOpen ? (
                                        <div className="space-y-2 border-t border-border p-3">
                                          {classifications.map(({ classification, items }) => {
                                            const groupKey = `${cropType}:${classification}`;
                                            const groupIsOpen =
                                              Boolean(normalizedStockSearch) ||
                                              expandedStockGroups.includes(groupKey);

                                            return (
                                              <div
                                                key={classification}
                                                className="overflow-hidden rounded-xl border border-border bg-background"
                                              >
                                                <button
                                                  type="button"
                                                  aria-expanded={groupIsOpen}
                                                  onClick={() =>
                                                    setExpandedStockGroups((current) =>
                                                      current.includes(groupKey)
                                                        ? current.filter(
                                                            (item) => item !== groupKey,
                                                          )
                                                        : [...current, groupKey],
                                                    )
                                                  }
                                                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                                                >
                                                  <span
                                                    className={
                                                      classification === "Good"
                                                        ? "text-sm font-semibold text-good"
                                                        : classification === "Semi"
                                                          ? "text-sm font-semibold text-semi"
                                                          : "text-sm font-semibold text-reject"
                                                    }
                                                  >
                                                    {classification} ({items.length})
                                                  </span>
                                                  <ChevronDown
                                                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                                                      groupIsOpen ? "rotate-180" : ""
                                                    }`}
                                                  />
                                                </button>
                                                {groupIsOpen ? (
                                                  <div className="space-y-1 border-t border-border p-2">
                                                    {items.map((item) => {
                                                      const isSelected = item.id === inventoryId;

                                                      return (
                                                        <button
                                                          key={item.id}
                                                          type="button"
                                                          aria-pressed={isSelected}
                                                          onClick={() => {
                                                            setInventoryId(item.id);
                                                            setStockSearch("");
                                                            setStockPickerOpen(false);
                                                          }}
                                                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-accent/50 ${
                                                            isSelected ? "bg-accent" : ""
                                                          }`}
                                                        >
                                                          <span className="min-w-0">
                                                            <span className="block truncate text-sm font-medium">
                                                              {item.name}
                                                            </span>
                                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                              {item.farmer ??
                                                                "Legacy / mixed stock"}{" "}
                                                              · {item.quantityKg} kg available
                                                            </span>
                                                          </span>
                                                          {isSelected ? (
                                                            <Check className="size-4 shrink-0 text-primary" />
                                                          ) : (
                                                            <span className="shrink-0 text-xs font-medium text-primary">
                                                              Select
                                                            </span>
                                                          )}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                ) : null}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                    </section>
                                  );
                                })
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        {publishableInventory.length === 0 ? (
                          <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                            No unused classified stock is ready yet. Record and classify a farmer
                            delivery first in{" "}
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
                            <span className="font-semibold">Selected:</span>{" "}
                            {selectedInventory.name} · {selectedInventory.classification} ·{" "}
                            {selectedInventory.quantityKg} kg available
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Only available stock that does not already have a listing appears here.
                          </p>
                        )}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="listing-status">When ready</Label>
                        <AppSelect
                          id="listing-status"
                          value={newListingStatus}
                          onValueChange={(value) =>
                            setNewListingStatus(value as "draft" | "published")
                          }
                          options={[
                            { value: "draft", label: "Save as draft — only Marketers can see it" },
                            { value: "published", label: "Publish now — buyers can see it" },
                          ]}
                        />
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
                                Retail ₱{retailPrice.toFixed(2)} / kg
                                {hasBundleInput
                                  ? ` · Bundle ₱${bundlePrice.toFixed(2)} / kg for ${bundleMinimum}+ kg`
                                  : null}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Add a valid retail price. If you add a bundle, it must be lower than
                                retail.
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
                        A bundle is optional. If used, its price must be lower than retail. The
                        classification is inherited from the selected stock.
                      </p>
                      <div className="flex items-end sm:justify-end">
                        <Button
                          type="submit"
                          className="w-full rounded-full sm:w-auto"
                          disabled={savingListing || !listingReady}
                        >
                          {savingListing
                            ? "Saving…"
                            : newListingStatus === "published"
                              ? "Publish listing"
                              : "Save draft"}
                        </Button>
                      </div>
                    </form>
                  </section>
                </section>
              ) : null}
            </div>
            <aside className="mt-8 flex gap-3 rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">
              <ShoppingBag className="mt-0.5 size-5 shrink-0 text-primary" />
              <p>
                Buyers can browse listings without signing in. Login is required before adding items
                to a cart or placing an order; no payment gateway is included.
              </p>
            </aside>
          </>
        ) : null}
      </main>
    </MarketerLayout>
  );
}

function optionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized ? Number(normalized) : null;
}
