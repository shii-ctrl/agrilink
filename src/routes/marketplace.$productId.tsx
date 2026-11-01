import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  LockKeyhole,
  Minus,
  PackageCheck,
  Plus,
  ShoppingCart,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ClassificationBadge } from "@/features/marketplace/components/classification-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { peso, type Product } from "@/features/marketplace/products";
import { ProductCard } from "@/features/marketplace/components/product-card";
import { marketplaceImageFor } from "@/features/marketplace/marketplace-images";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getCurrentSessionUser } from "@/services/auth/auth-functions";
import { notifyBuyerCartChanged } from "@/features/marketplace/cart-events";
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

function ProductDetail() {
  const router = useRouter();
  const { product, related } = Route.useLoaderData() as MarketplaceProductDetailData;
  const offers = product.offers?.length
    ? product.offers
    : [
        {
          id: product.id,
          classification: product.classification as "Good" | "Semi",
          pricePerKg: product.pricePerKg,
          retailPricePerKg: product.retailPricePerKg,
          bundlePricePerKg: product.bundlePricePerKg,
          bundleMinimumKg: product.bundleMinimumKg,
          quantityKg: product.quantityKg,
        },
      ];
  const [selectedOfferId, setSelectedOfferId] = useState(offers[0]?.id ?? product.id);
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? offers[0]!;
  const [quantityInput, setQuantityInput] = useState("1");
  const [isBuyer, setIsBuyer] = useState(false);
  const [cartQuantityKg, setCartQuantityKg] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
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
  const requestedQuantity = Number(quantityInput);
  const qty = Number.isFinite(requestedQuantity) ? requestedQuantity : 0;
  const hasValidQuantity = qty >= 0.01 && qty <= maximumSelectableQuantity;
  const canDecreaseQuantity = qty > 0.01;
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

  useEffect(() => {
    setQuantityInput((current) => {
      const currentQuantity = Number(current);
      return Number.isFinite(currentQuantity) && currentQuantity > maximumSelectableQuantity
        ? String(maximumSelectableQuantity)
        : current;
    });
  }, [maximumSelectableQuantity]);

  function clampQuantity(value: number) {
    return Math.min(maximumSelectableQuantity, Math.max(0.01, Math.round(value * 100) / 100));
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
            description: `${qty} kg of ${product.name} is saved to your account.`,
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
          description: `${qty} kg of ${product.name} was reserved in your cart.`,
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
    <main className="mx-auto w-full max-w-6xl px-4 pb-40 pt-8 sm:pb-0 sm:pt-10">
      <Link
        to="/marketplace"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to marketplace
      </Link>

      <div className="mt-4 grid gap-6 sm:mt-6 sm:gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl shadow-field sm:rounded-[2rem]">
          <img
            src={product.image}
            alt={product.name}
            width={900}
            height={700}
            className="aspect-[4/3] w-full object-cover"
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Choose quality
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {offers.map((offer) => (
              <button
                key={offer.id}
                type="button"
                onClick={() => {
                  setSelectedOfferId(offer.id);
                  setQuantityInput("1");
                }}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  offer.id === selectedOffer.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {offer.classification} ·{" "}
                {offer.quantityKg > 0 ? `${offer.quantityKg} kg` : "Sold out"}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <ClassificationBadge value={selectedOffer.classification} />
          </div>
          <h1 className="mt-3 text-3xl font-semibold sm:mt-4 sm:text-4xl md:text-5xl">
            {product.name}
          </h1>
          <p className="mt-2 text-sm uppercase tracking-wide text-muted-foreground">
            {product.cropType}
          </p>

          <p className="mt-5 font-display text-3xl font-semibold text-primary sm:mt-6 sm:text-4xl">
            {peso(currentPricePerKg)}
            <span className="ml-2 text-base font-normal text-muted-foreground">/ kg</span>
          </p>
          {selectedOffer.bundlePricePerKg && selectedOffer.bundleMinimumKg ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Retail: {peso(retailPricePerKg)} / kg · Bundle: {peso(selectedOffer.bundlePricePerKg)}{" "}
              / kg from {selectedOffer.bundleMinimumKg} kg
              {qualifiesForBundle ? " — bundle price applied" : ""}
            </p>
          ) : null}

          <dl className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Available quantity
              </dt>
              <dd className="mt-1 text-lg font-semibold">{availableQuantity} kg</dd>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Availability
              </dt>
              <dd
                className={`mt-1 flex items-center gap-2 text-lg font-semibold ${
                  isAvailable ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <PackageCheck className="size-5" />
                {isAvailable ? "Available" : "Unavailable"}
              </dd>
            </div>
          </dl>

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          <div className="mt-7 hidden items-center gap-2 sm:mt-8 sm:flex sm:flex-wrap sm:gap-4">
            <div className="col-span-2 flex items-center justify-center gap-1 rounded-full border border-border bg-card p-1 sm:col-span-1 sm:justify-start">
              <button
                onClick={() => setQuantityInput(String(clampQuantity((qty || 0.01) - 1)))}
                disabled={!isAvailable || !canDecreaseQuantity}
                className="flex size-9 items-center justify-center rounded-full hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Decrease quantity"
              >
                <Minus className="size-4" />
              </button>
              <Input
                aria-label="Quantity in kilograms"
                type="number"
                inputMode="decimal"
                min="0.01"
                max={maximumSelectableQuantity}
                step="0.01"
                value={quantityInput}
                disabled={!isAvailable}
                onChange={(event) => setQuantityInput(event.target.value)}
                onBlur={() => setQuantityInput(String(clampQuantity(Number(quantityInput) || 1)))}
                className="h-9 w-20 border-0 bg-transparent px-1 text-center font-semibold shadow-none focus-visible:ring-0"
              />
              <span className="pr-1 text-sm text-muted-foreground">kg</span>
              <button
                onClick={() => setQuantityInput(String(clampQuantity((qty || 0) + 1)))}
                disabled={!isAvailable || !canIncreaseQuantity}
                className="flex size-9 items-center justify-center rounded-full hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Increase quantity"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-full sm:w-auto"
              disabled={
                !isAvailable ||
                !hasValidQuantity ||
                isAdding ||
                isBuyingNow ||
                (isBuyer && remainingCartableQuantity <= 0)
              }
              onClick={handleAddToCart}
            >
              <ShoppingCart className="size-4" />
              {isAdding
                ? "Adding…"
                : isBuyer && remainingCartableQuantity <= 0
                  ? "Already in cart"
                  : "Add to cart"}
            </Button>
            <Button
              size="lg"
              className="w-full rounded-full sm:w-auto"
              disabled={
                !isAvailable ||
                !hasValidQuantity ||
                isAdding ||
                isBuyingNow ||
                (isBuyer && remainingCartableQuantity <= 0)
              }
              onClick={handleBuyNow}
            >
              <Zap className="size-4" />
              {isBuyingNow ? "Preparing checkout…" : "Buy now"}
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            {isAvailable
              ? cartQuantityKg > 0
                ? `Cart total for ${pricedQuantityKg} kg: ${peso(pricedQuantityKg * currentPricePerKg)} · Sold by PROCY, supplied by AgriLink farmer members.`
                : `Subtotal for ${qty} kg: ${peso(qty * currentPricePerKg)} · Sold by PROCY, supplied by AgriLink farmer members.`
              : "This listing is currently unavailable."}
          </p>
          {isBuyer && cartQuantityKg > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {remainingCartableQuantity > 0
                ? `${cartQuantityKg} kg is already in your cart. You can add up to ${remainingCartableQuantity} kg more.`
                : `All ${cartQuantityKg} kg available is already in your cart.`}
            </p>
          ) : (
            isAvailable && (
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
            )
          )}
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.12)] backdrop-blur sm:hidden">
        <div className="mx-auto max-w-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Selected subtotal</p>
              <p className="truncate font-semibold text-primary">
                {peso(qty * currentPricePerKg)} · {qty} kg
              </p>
            </div>
            <div className="flex shrink-0 items-center rounded-full border border-border bg-card p-1">
              <button
                onClick={() => setQuantityInput(String(clampQuantity((qty || 0.01) - 1)))}
                disabled={!isAvailable || !canDecreaseQuantity}
                className="flex size-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
                aria-label="Decrease quantity"
              >
                <Minus className="size-4" />
              </button>
              <Input
                aria-label="Mobile quantity in kilograms"
                type="number"
                inputMode="decimal"
                min="0.01"
                max={maximumSelectableQuantity}
                step="0.01"
                value={quantityInput}
                disabled={!isAvailable}
                onChange={(event) => setQuantityInput(event.target.value)}
                onBlur={() => setQuantityInput(String(clampQuantity(Number(quantityInput) || 1)))}
                className="h-8 w-14 border-0 bg-transparent px-0 text-center text-base font-semibold shadow-none focus-visible:ring-0"
              />
              <span className="mr-1 text-xs text-muted-foreground">kg</span>
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
                !isAvailable ||
                !hasValidQuantity ||
                isAdding ||
                isBuyingNow ||
                (isBuyer && remainingCartableQuantity <= 0)
              }
              onClick={handleAddToCart}
            >
              <ShoppingCart className="size-4" />
              {isAdding
                ? "Adding…"
                : isBuyer && remainingCartableQuantity <= 0
                  ? "In cart"
                  : "Add to cart"}
            </Button>
            <Button
              className="min-h-11 rounded-full"
              disabled={
                !isAvailable ||
                !hasValidQuantity ||
                isAdding ||
                isBuyingNow ||
                (isBuyer && remainingCartableQuantity <= 0)
              }
              onClick={handleBuyNow}
            >
              <Zap className="size-4" />
              {isBuyingNow ? "Preparing…" : "Buy now"}
            </Button>
          </div>
        </div>
      </div>
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
