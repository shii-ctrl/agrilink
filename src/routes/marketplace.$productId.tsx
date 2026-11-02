import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  ImageIcon,
  LockKeyhole,
  Maximize2,
  Minus,
  PackageCheck,
  PackageX,
  Plus,
  ShoppingCart,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { peso, type Product } from "@/features/marketplace/products";
import { ProductCard } from "@/features/marketplace/components/product-card";
import { marketplaceImageFor } from "@/features/marketplace/marketplace-images";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getCurrentSessionUser } from "@/services/auth/auth-functions";
import { notifyBuyerCartChanged } from "@/features/marketplace/cart-events";
import {
  formatSellingQuantity,
  requiresWholeSellingQuantity,
  sellingUnitLabel,
  sellingUnitStep,
} from "@/features/marketplace/selling-units";
import {
  addBuyerCartItem,
  getBuyerCart,
  getMarketplaceListing,
  getMarketplaceListings,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/marketplace/$productId")({
  loader: async ({ params }) => {
    const product = await getMarketplaceListing({ data: { listingId: params.productId } });
    if (!product) throw notFound();
    const related = (await getMarketplaceListings())
      .filter((listing) => listing.id !== product.id && listing.cropType === product.cropType)
      .map((listing) => ({
        ...listing,
        image: listing.image || marketplaceImageFor(listing.name),
      }));
    return {
      product: { ...product, image: product.image || marketplaceImageFor(product.name) },
      related,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Product unavailable — AgriLink" }, { name: "robots", content: "noindex" }],
      };
    }
    const { product } = loaderData;
    const title = `${product.name} | AgriLink Marketplace`;
    return {
      meta: [
        { title },
        { name: "description", content: product.description },
        { property: "og:title", content: title },
        { property: "og:description", content: product.description },
      ],
    };
  },
  component: ProductDetail,
});

type MarketplaceProductDetailData = { product: Product; related: Product[] };

function displayProductName(name: string) {
  return name.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function ProductDetail() {
  const router = useRouter();
  const { product, related } = Route.useLoaderData() as MarketplaceProductDetailData;
  const offers = product.offers?.length
    ? product.offers
    : [
        {
          id: product.id,
          classification: product.classification,
          pricePerKg: product.pricePerKg,
          retailPricePerKg: product.retailPricePerKg,
          bundlePricePerKg: product.bundlePricePerKg,
          bundleMinimumKg: product.bundleMinimumKg,
          quantityKg: product.quantityKg,
          image: product.image,
          priceConfigured: true,
        },
      ];
  const [selectedOfferId, setSelectedOfferId] = useState(offers[0]?.id ?? product.id);
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? offers[0]!;
  const selectedOfferHasPrice = selectedOffer.priceConfigured !== false;
  const [quantityInput, setQuantityInput] = useState("1");
  const [isBuyer, setIsBuyer] = useState(false);
  const [cartQuantityKg, setCartQuantityKg] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  useEffect(() => {
    if (!isImageOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsImageOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isImageOpen]);
  useAutoRefresh(() => router.invalidate());
  useEffect(() => {
    let mounted = true;
    void getCurrentSessionUser()
      .then(async (user) => {
        const buyer = user?.roles.includes("Buyer") ?? false;
        if (!mounted) return;
        setIsBuyer(buyer);
        if (!buyer) {
          setCartQuantityKg(0);
          return;
        }
        const cart = await getBuyerCart();
        if (!mounted) return;
        setCartQuantityKg(cart.find((item) => item.id === selectedOffer.id)?.quantityKg ?? 0);
        void router.invalidate();
      })
      .catch(() => {
        if (!mounted) return;
        setIsBuyer(false);
        setCartQuantityKg(0);
      });
    return () => {
      mounted = false;
    };
  }, [router, selectedOffer.id]);
  const availableQuantity = selectedOffer.quantityKg;
  const isAvailable = availableQuantity > 0;
  const remainingCartableQuantity = Math.max(0, availableQuantity);
  const maximumSelectableQuantity = Math.max(1, availableQuantity);
  const quantityStep = sellingUnitStep(product.sellingUnit);
  const requestedQuantity = Number(quantityInput);
  const qty = Number.isFinite(requestedQuantity) ? requestedQuantity : 0;
  const hasValidQuantity =
    qty >= quantityStep &&
    qty <= maximumSelectableQuantity &&
    (!requiresWholeSellingQuantity(product.sellingUnit) || Number.isInteger(qty));
  const canDecreaseQuantity = qty > quantityStep;
  const canIncreaseQuantity = qty < maximumSelectableQuantity;
  const retailPricePerKg = selectedOffer.retailPricePerKg ?? selectedOffer.pricePerKg;
  const pricedQuantityKg = isBuyer ? cartQuantityKg + qty : qty;
  const qualifiesForBundle =
    selectedOffer.bundlePricePerKg !== null &&
    selectedOffer.bundlePricePerKg !== undefined &&
    selectedOffer.bundleMinimumKg !== null &&
    selectedOffer.bundleMinimumKg !== undefined &&
    pricedQuantityKg >= selectedOffer.bundleMinimumKg;
  const currentPricePerKg = qualifiesForBundle ? selectedOffer.bundlePricePerKg! : retailPricePerKg;
  const bundleSavingsPerUnit =
    selectedOffer.bundlePricePerKg !== null && selectedOffer.bundlePricePerKg !== undefined
      ? Math.max(0, retailPricePerKg - selectedOffer.bundlePricePerKg)
      : 0;
  const productName = displayProductName(product.name);
  const hasCartReservation = isBuyer && cartQuantityKg > 0;
  const canPurchase = isAvailable && selectedOfferHasPrice;

  useEffect(() => {
    setQuantityInput((current) => {
      const currentQuantity = Number(current);
      return Number.isFinite(currentQuantity) && currentQuantity > maximumSelectableQuantity
        ? String(maximumSelectableQuantity)
        : current;
    });
  }, [maximumSelectableQuantity]);

  function clampQuantity(value: number) {
    const rounded = requiresWholeSellingQuantity(product.sellingUnit)
      ? Math.round(value)
      : Math.round(value * 100) / 100;
    return Math.min(maximumSelectableQuantity, Math.max(quantityStep, rounded));
  }

  function handleAddToCart() {
    if (isBuyer) {
      setIsAdding(true);
      void addBuyerCartItem({ data: { listingId: selectedOffer.id, quantityKg: qty } })
        .then((cart) => {
          setCartQuantityKg(cart.find((item) => item.id === selectedOffer.id)?.quantityKg ?? 0);
          void router.invalidate();
          notifyBuyerCartChanged();
          toast.success("Added to your cart", {
            description: `${formatSellingQuantity(qty, product.sellingUnit)} of ${product.name} is saved to your account.`,
          });
        })
        .catch((error) => {
          toast.error("Could not add this product", {
            description: error instanceof Error ? error.message : "Please refresh and try again.",
          });
        })
        .finally(() => setIsAdding(false));
      return;
    }

    toast.custom(
      (id) => (
        <div className="relative w-[min(92vw,440px)] overflow-hidden rounded-3xl border border-primary/25 bg-card p-5 shadow-field">
          <div className="absolute inset-x-0 top-0 h-1.5 surface-sprout" />
          <button
            onClick={() => toast.dismiss(id)}
            className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
          <div className="flex gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl surface-sprout shadow-card">
              <LockKeyhole className="size-5" />
            </span>
            <div className="pr-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Buyer access
              </p>
              <h3 className="mt-1 text-lg font-semibold">Ready to build your order?</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Sign in or create a Buyer account to add{" "}
                <span className="font-medium text-foreground">{product.name}</span> to your cart.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => (window.location.href = "/login")}
                >
                  Login to continue
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => (window.location.href = "/register")}
                >
                  Register
                </Button>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        unstyled: true,
        className: "!min-w-0 !border-0 !bg-transparent !p-0 !shadow-none",
      },
    );
  }

  function handleBuyNow() {
    if (!isBuyer) {
      toast.error("Sign in as a Buyer to buy now", {
        description: "Login or register first, then you can go directly to checkout.",
      });
      return;
    }

    setIsBuyingNow(true);
    void addBuyerCartItem({ data: { listingId: selectedOffer.id, quantityKg: qty } })
      .then((cart) => {
        setCartQuantityKg(cart.find((item) => item.id === selectedOffer.id)?.quantityKg ?? 0);
        notifyBuyerCartChanged();
        toast.success("Ready to place your order", {
          description: `${formatSellingQuantity(qty, product.sellingUnit)} of ${product.name} was reserved in your cart.`,
        });
        void router.navigate({ to: "/buyer/cart" });
      })
      .catch((error) => {
        toast.error("Could not start checkout", {
          description: error instanceof Error ? error.message : "Please refresh and try again.",
        });
      })
      .finally(() => setIsBuyingNow(false));
  }

  const productContent = (
    <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:pb-0 sm:pt-10">
      <Link
        to="/marketplace"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to marketplace
      </Link>

      <div className="mt-4 grid items-start gap-7 sm:mt-6 sm:gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="lg:sticky lg:top-24">
          <button
            type="button"
            onClick={() => setIsImageOpen(true)}
            className="group relative block aspect-square w-full overflow-hidden rounded-3xl border border-border bg-muted text-left shadow-field sm:rounded-[2rem]"
            aria-label={`Enlarge ${selectedOffer.classification} photo of ${productName}`}
          >
            <img
              src={selectedOffer.image || product.image}
              alt={`${productName} — ${selectedOffer.classification} quality`}
              width={900}
              height={900}
              className="size-full object-cover transition duration-500 group-hover:scale-[1.025]"
            />
            <span className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-background/90 px-3 py-2 text-xs font-semibold shadow-card backdrop-blur transition group-hover:bg-background">
              <Maximize2 className="size-4" /> View photo
            </span>
          </button>

          {offers.length > 1 ? (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1" aria-label="Quality photos">
              {offers.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => {
                    setSelectedOfferId(offer.id);
                    setQuantityInput("1");
                  }}
                  className={`relative size-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-muted transition sm:size-24 ${
                    offer.id === selectedOffer.id
                      ? "border-primary shadow-card"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                  aria-label={`Show ${offer.classification} quality photo`}
                  aria-pressed={offer.id === selectedOffer.id}
                >
                  <img
                    src={offer.image || product.image}
                    alt=""
                    className="size-full object-cover"
                  />
                  <span className="absolute inset-x-1 bottom-1 rounded-full bg-background/90 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur">
                    {offer.classification}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-primary">
            {product.cropType}
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl md:text-5xl">{productName}</h1>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Choose quality
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {offers.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => {
                    setSelectedOfferId(offer.id);
                    setQuantityInput("1");
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    offer.id === selectedOffer.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                  aria-pressed={offer.id === selectedOffer.id}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{offer.classification}</span>
                    <span
                      className={`text-xs font-medium ${offer.quantityKg > 0 ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {offer.id === selectedOffer.id && hasCartReservation && offer.quantityKg <= 0
                        ? "Reserved"
                        : offer.quantityKg > 0
                          ? formatSellingQuantity(offer.quantityKg, product.sellingUnit)
                          : "No stock"}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {offer.priceConfigured === false
                      ? "Price not set"
                      : `${peso(offer.retailPricePerKg ?? offer.pricePerKg)} / ${sellingUnitLabel(product.sellingUnit)}`}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <p className="mt-6 font-display text-3xl font-semibold text-primary sm:text-4xl">
            {selectedOfferHasPrice ? peso(currentPricePerKg) : "No price yet"}
            {selectedOfferHasPrice ? (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                / {sellingUnitLabel(product.sellingUnit)}
              </span>
            ) : null}
          </p>
          {selectedOfferHasPrice &&
          selectedOffer.bundlePricePerKg &&
          selectedOffer.bundleMinimumKg ? (
            <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">Bundle deal</span>
                {bundleSavingsPerUnit > 0 ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    Save {peso(bundleSavingsPerUnit)} per {sellingUnitLabel(product.sellingUnit)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-muted-foreground">
                {peso(selectedOffer.bundlePricePerKg)} / {sellingUnitLabel(product.sellingUnit)}{" "}
                when ordering{" "}
                {formatSellingQuantity(selectedOffer.bundleMinimumKg, product.sellingUnit)}
                or more.{qualifiesForBundle ? " Bundle price is applied to your selection." : ""}
              </p>
            </div>
          ) : null}

          <div
            className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 ${
              hasCartReservation && !isAvailable
                ? "border-primary/25 bg-primary/5"
                : canPurchase
                  ? "border-primary/20 bg-primary/5"
                  : "border-border bg-muted/60"
            }`}
          >
            {hasCartReservation && !isAvailable ? (
              <ShoppingCart className="mt-0.5 size-5 shrink-0 text-primary" />
            ) : canPurchase ? (
              <PackageCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            ) : (
              <PackageX className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <p className="font-semibold">
                {hasCartReservation && !isAvailable
                  ? "Reserved in your cart"
                  : canPurchase
                    ? `${formatSellingQuantity(availableQuantity, product.sellingUnit)} available`
                    : selectedOfferHasPrice
                      ? "Currently unavailable"
                      : "Price and stock unavailable"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {hasCartReservation && !isAvailable
                  ? `${formatSellingQuantity(cartQuantityKg, product.sellingUnit)} is reserved for you. Continue to your cart before the reservation expires.`
                  : canPurchase
                    ? "Available now from PROCY farmer-member supply."
                    : "This quality will automatically become available after new stock and pricing are recorded."}
              </p>
              {hasCartReservation && !isAvailable ? (
                <Link
                  to="/buyer/cart"
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card"
                >
                  <ShoppingCart className="size-4" /> View cart
                </Link>
              ) : null}
            </div>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          {canPurchase ? (
            <div className="mt-7 hidden items-center gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <div className="flex items-center justify-center gap-1 rounded-full border border-border bg-card p-1 sm:justify-start">
                <button
                  onClick={() => setQuantityInput(String(clampQuantity((qty || quantityStep) - 1)))}
                  disabled={!canDecreaseQuantity}
                  className="flex size-9 items-center justify-center rounded-full hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-4" />
                </button>
                <Input
                  aria-label={`Quantity in ${sellingUnitLabel(product.sellingUnit, 2)}`}
                  type="number"
                  inputMode={
                    requiresWholeSellingQuantity(product.sellingUnit) ? "numeric" : "decimal"
                  }
                  min={quantityStep}
                  max={maximumSelectableQuantity}
                  step={quantityStep}
                  value={quantityInput}
                  onChange={(event) => setQuantityInput(event.target.value)}
                  onBlur={() => setQuantityInput(String(clampQuantity(Number(quantityInput) || 1)))}
                  className="h-9 w-20 border-0 bg-transparent px-1 text-center font-semibold shadow-none focus-visible:ring-0"
                />
                <span className="pr-1 text-sm text-muted-foreground">
                  {sellingUnitLabel(product.sellingUnit, qty)}
                </span>
                <button
                  onClick={() => setQuantityInput(String(clampQuantity((qty || 0) + 1)))}
                  disabled={!canIncreaseQuantity}
                  className="flex size-9 items-center justify-center rounded-full hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  className="min-w-0 flex-1 whitespace-nowrap rounded-full px-4"
                  disabled={
                    !hasValidQuantity || isAdding || isBuyingNow || remainingCartableQuantity <= 0
                  }
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="size-4" />
                  {isAdding ? "Adding…" : hasCartReservation ? "Add more" : "Add to cart"}
                </Button>
                <Button
                  size="lg"
                  className="min-w-0 flex-1 whitespace-nowrap rounded-full px-4"
                  disabled={
                    !hasValidQuantity || isAdding || isBuyingNow || remainingCartableQuantity <= 0
                  }
                  onClick={handleBuyNow}
                >
                  <Zap className="size-4" />
                  {isBuyingNow ? "Preparing checkout…" : "Buy now"}
                </Button>
              </div>
              {hasCartReservation ? (
                <Link
                  to="/buyer/cart"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-primary hover:bg-primary/5"
                >
                  <ShoppingCart className="size-4" /> View cart
                </Link>
              ) : null}
            </div>
          ) : null}

          {canPurchase ? (
            <div className="mt-4 text-xs leading-relaxed text-muted-foreground">
              <p>
                Subtotal for {formatSellingQuantity(qty, product.sellingUnit)}:{" "}
                {peso(qty * currentPricePerKg)}
                {hasCartReservation
                  ? ` · ${formatSellingQuantity(cartQuantityKg, product.sellingUnit)} already reserved in your cart.`
                  : ""}
              </p>
              <p className="mt-1">Sold by PROCY and supplied by AgriLink farmer members.</p>
            </div>
          ) : null}
          {!isBuyer && canPurchase ? (
            <p className="mt-2 text-xs text-muted-foreground">
              You need to{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                log in
              </Link>{" "}
              or{" "}
              <Link to="/register" className="font-medium text-primary hover:underline">
                register as a buyer
              </Link>{" "}
              to add this item to your cart.
            </p>
          ) : null}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12 sm:mt-24">
          <h2 className="text-2xl font-semibold">Related produce</h2>
          <div className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {(canPurchase || hasCartReservation) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.12)] backdrop-blur sm:hidden">
          <div className="mx-auto max-w-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {canPurchase ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Selected subtotal</p>
                    <p className="truncate font-semibold text-primary">
                      {peso(qty * currentPricePerKg)} ·{" "}
                      {formatSellingQuantity(qty, product.sellingUnit)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center rounded-full border border-border bg-card p-1">
                    <button
                      onClick={() =>
                        setQuantityInput(String(clampQuantity((qty || quantityStep) - 1)))
                      }
                      disabled={!isAvailable || !canDecreaseQuantity}
                      className="flex size-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="size-4" />
                    </button>
                    <Input
                      aria-label={`Mobile quantity in ${sellingUnitLabel(product.sellingUnit, 2)}`}
                      type="number"
                      inputMode={
                        requiresWholeSellingQuantity(product.sellingUnit) ? "numeric" : "decimal"
                      }
                      min={quantityStep}
                      max={maximumSelectableQuantity}
                      step={quantityStep}
                      value={quantityInput}
                      onChange={(event) => setQuantityInput(event.target.value)}
                      onBlur={() =>
                        setQuantityInput(String(clampQuantity(Number(quantityInput) || 1)))
                      }
                      className="h-8 w-14 border-0 bg-transparent px-0 text-center text-base font-semibold shadow-none focus-visible:ring-0"
                    />
                    <span className="mr-1 text-xs text-muted-foreground">
                      {sellingUnitLabel(product.sellingUnit, qty)}
                    </span>
                    <button
                      onClick={() => setQuantityInput(String(clampQuantity((qty || 0) + 1)))}
                      disabled={!isAvailable || !canIncreaseQuantity}
                      className="flex size-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="min-h-11 rounded-full"
                    disabled={
                      !hasValidQuantity || isAdding || isBuyingNow || remainingCartableQuantity <= 0
                    }
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="size-4" />
                    {isAdding ? "Adding…" : hasCartReservation ? "Add more" : "Add to cart"}
                  </Button>
                  <Button
                    className="min-h-11 rounded-full"
                    disabled={
                      !hasValidQuantity || isAdding || isBuyingNow || remainingCartableQuantity <= 0
                    }
                    onClick={handleBuyNow}
                  >
                    <Zap className="size-4" />
                    {isBuyingNow ? "Preparing…" : "Buy now"}
                  </Button>
                </div>
              </>
            ) : (
              <Link
                to="/buyer/cart"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-semibold text-primary-foreground"
              >
                <ShoppingCart className="size-4" /> View reserved item in cart
              </Link>
            )}
          </div>
        </div>
      )}

      {isImageOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} photo preview`}
          onClick={() => setIsImageOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsImageOpen(false)}
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-background text-foreground shadow-field"
            aria-label="Close photo preview"
          >
            <X className="size-5" />
          </button>
          <div className="max-h-[90vh] max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <img
              src={selectedOffer.image || product.image}
              alt={`${productName} — ${selectedOffer.classification} quality`}
              className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-field"
            />
            <p className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-white">
              <ImageIcon className="size-4" /> {selectedOffer.classification} quality
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      {productContent}
      <SiteFooter />
    </div>
  );
}
