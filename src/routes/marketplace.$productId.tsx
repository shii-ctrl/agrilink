import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole, Minus, PackageCheck, Plus, ShoppingCart, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ClassificationBadge } from "@/components/classification-badge";
import { Button } from "@/components/ui/button";
import { peso } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { marketplaceImageFor } from "@/lib/marketplace-images";
import { getCurrentSessionUser } from "@/lib/auth-functions";
import { notifyBuyerCartChanged } from "@/lib/cart-events";
import {
  addBuyerCartItem,
  getBuyerCart,
  getMarketplaceListing,
  getMarketplaceListings,
} from "@/lib/marketplace-server-functions";

export const Route = createFileRoute("/marketplace/$productId")({
  loader: async ({ params }) => {
    const product = await getMarketplaceListing({ data: { listingId: params.productId } });
    if (!product) throw notFound();
    const related = (await getMarketplaceListings())
      .filter((listing) => listing.id !== product.id && listing.name === product.name)
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
    const title = `${product.name} — ${product.classification} | AgriLink Marketplace`;
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

function ProductDetail() {
  const { product, related } = Route.useLoaderData();
  const [qty, setQty] = useState(1);
  const [isBuyer, setIsBuyer] = useState(false);
  const [cartQuantityKg, setCartQuantityKg] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
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
        setCartQuantityKg(cart.find((item) => item.id === product.id)?.quantityKg ?? 0);
      })
      .catch(() => {
        if (!mounted) return;
        setIsBuyer(false);
        setCartQuantityKg(0);
      });
    return () => {
      mounted = false;
    };
  }, [product.id]);
  const availableQuantity = product.quantityKg;
  const isAvailable = availableQuantity > 0;
  const remainingCartableQuantity = Math.max(0, availableQuantity - cartQuantityKg);
  const maximumSelectableQuantity = Math.max(
    1,
    isBuyer ? remainingCartableQuantity : availableQuantity,
  );
  const canDecreaseQuantity = qty > 1;
  const canIncreaseQuantity = qty < maximumSelectableQuantity;
  const retailPricePerKg = product.retailPricePerKg ?? product.pricePerKg;
  const pricedQuantityKg = isBuyer ? cartQuantityKg + qty : qty;
  const qualifiesForBundle =
    product.bundlePricePerKg !== null &&
    product.bundlePricePerKg !== undefined &&
    product.bundleMinimumKg !== null &&
    product.bundleMinimumKg !== undefined &&
    pricedQuantityKg >= product.bundleMinimumKg;
  const currentPricePerKg = qualifiesForBundle ? product.bundlePricePerKg! : retailPricePerKg;

  useEffect(() => {
    setQty((current) => Math.min(current, maximumSelectableQuantity));
  }, [maximumSelectableQuantity]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pt-10">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to marketplace
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[2rem] shadow-field">
            <img
              src={product.image}
              alt={`${product.name} — ${product.classification} classification`}
              width={900}
              height={700}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>

          <div>
            <ClassificationBadge value={product.classification} />
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{product.name}</h1>
            <p className="mt-2 text-sm uppercase tracking-wide text-muted-foreground">
              {product.cropType}
            </p>

            <p className="mt-6 font-display text-4xl font-semibold text-primary">
              {peso(currentPricePerKg)}
              <span className="ml-2 text-base font-normal text-muted-foreground">/ kg</span>
            </p>
            {product.bundlePricePerKg && product.bundleMinimumKg ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Retail: {peso(retailPricePerKg)} / kg · Bundle: {peso(product.bundlePricePerKg)} /
                kg from {product.bundleMinimumKg} kg
                {qualifiesForBundle ? " — bundle price applied" : ""}
              </p>
            ) : null}

            <dl className="mt-6 grid grid-cols-2 gap-3">
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

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={!isAvailable || !canDecreaseQuantity}
                  className="flex size-9 items-center justify-center rounded-full hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-14 text-center font-semibold">{qty} kg</span>
                <button
                  onClick={() => setQty((q) => Math.min(maximumSelectableQuantity, q + 1))}
                  disabled={!isAvailable || !canIncreaseQuantity}
                  className="flex size-9 items-center justify-center rounded-full hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <Button
                size="lg"
                className="rounded-full"
                disabled={!isAvailable || isAdding || (isBuyer && remainingCartableQuantity <= 0)}
                onClick={() => {
                  if (isBuyer) {
                    setIsAdding(true);
                    void addBuyerCartItem({ data: { listingId: product.id, quantityKg: qty } })
                      .then((cart) => {
                        setCartQuantityKg(
                          cart.find((item) => item.id === product.id)?.quantityKg ?? 0,
                        );
                        notifyBuyerCartChanged();
                        toast.success("Added to your cart", {
                          description: `${qty} kg of ${product.name} is saved to your account.`,
                        });
                      })
                      .catch((error) => {
                        toast.error("Could not add this product", {
                          description:
                            error instanceof Error
                              ? error.message
                              : "Please refresh and try again.",
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
                            <h3 className="mt-1 text-lg font-semibold">
                              Ready to build your order?
                            </h3>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                              Sign in or create a Buyer account to add{" "}
                              <span className="font-medium text-foreground">{product.name}</span> to
                              your cart.
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
                }}
              >
                <ShoppingCart className="size-4" />
                {isAdding
                  ? "Adding…"
                  : isBuyer && remainingCartableQuantity <= 0
                    ? "Already in cart"
                    : "Add to cart"}
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
          <section className="mt-24">
            <h2 className="text-2xl font-semibold">Other {product.name} classifications</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
