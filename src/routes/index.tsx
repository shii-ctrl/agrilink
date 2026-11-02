import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardCheck,
  Clock3,
  Egg,
  ImageIcon,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sprout,
  Store,
  Tags,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { z } from "zod";
import landingPlaceholder from "@/assets/landing-market-placeholder.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { LoginDialog } from "@/features/auth/components/login-dialog";
import { PasswordResetDialog } from "@/features/auth/components/password-reset-dialog";
import { RegisterDialog } from "@/features/auth/components/register-dialog";
import { ProductCard } from "@/features/marketplace/components/product-card";
import type { Product } from "@/features/marketplace/products";
import { getCurrentSessionUser } from "@/services/auth/auth-functions";
import { marketplaceImageFor } from "@/features/marketplace/marketplace-images";
import { authSessionChangedEvent } from "@/lib/auth/session-events";
import { getMarketplaceListings } from "@/services/marketplace/marketplace-server-functions";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

export const Route = createFileRoute("/")({
  validateSearch: z.object({
    auth: z.enum(["login", "register", "reset"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "AgriLink — Fresh Local Produce from PROCY" },
      {
        name: "description",
        content:
          "Shop live agricultural products supplied by local farmer members, quality-classified and fulfilled by PROCY.",
      },
      { property: "og:title", content: "AgriLink — Fresh Local Produce from PROCY" },
      {
        property: "og:description",
        content: "Compare quality, check live stock, and place your order with PROCY.",
      },
    ],
  }),
  component: Index,
});

type SessionAccount = {
  username: string;
  displayName: string;
  roles: string[];
};

const categories = [
  { label: "Available today", icon: PackageCheck, search: { available: true } },
  { label: "Vegetables", icon: Sprout, search: { q: "crops", available: true } },
  { label: "Fruits", icon: Tags, search: { crop: "Fruits", available: true } },
  { label: "Eggs", icon: Egg, search: { q: "itlog", available: true } },
  { label: "Bundle deals", icon: ShoppingBag, search: { deals: true, available: true } },
] as const;

const orderSteps = [
  {
    icon: Search,
    title: "Choose",
    body: "Select a product and compare its available quality options.",
  },
  {
    icon: ShoppingCart,
    title: "Reserve",
    body: "Choose a quantity and add it to your Buyer cart.",
  },
  {
    icon: ClipboardCheck,
    title: "Confirm",
    body: "Submit the order and wait for confirmation from PROCY.",
  },
  {
    icon: ShoppingBag,
    title: "Pick up",
    body: "Collect your confirmed order using the saved order details.",
  },
];

const trustPoints = [
  {
    icon: BadgeCheck,
    title: "Quality classified",
    body: "Good, Semi, and Reject options are clearly identified.",
  },
  {
    icon: PackageCheck,
    title: "Live stock",
    body: "Availability updates from actual product receiving records.",
  },
  {
    icon: Store,
    title: "One trusted seller",
    body: "PROCY prices, confirms, and fulfills every Buyer order.",
  },
];

function availableQuantity(product: Product) {
  return (product.offers ?? []).reduce(
    (total, offer) => total + (offer.priceConfigured === false ? 0 : offer.quantityKg),
    0,
  );
}

function FeaturedSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-card"
      aria-hidden="true"
    >
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
        <div className="h-6 w-44 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

function Index() {
  const navigate = useNavigate();
  const { auth } = Route.useSearch();
  const [account, setAccount] = useState<SessionAccount | null>(null);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [heroQuery, setHeroQuery] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [featuredAutoScroll] = useState(() =>
    AutoScroll({
      direction: "forward",
      speed: 0.8,
      startDelay: 0,
      playOnInit: false,
      stopOnFocusIn: true,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    }),
  );
  const [featuredCarouselRef, featuredCarouselApi] = useEmblaCarousel(
    { align: "start", containScroll: "trimSnaps", dragFree: true, loop: true },
    [featuredAutoScroll],
  );

  const isBuyer = Boolean(account?.roles.includes("Buyer"));
  const buyerName = account?.displayName || account?.username || "Buyer";
  const availableFeatured = useMemo(
    () => featured.filter((product) => availableQuantity(product) > 0).length,
    [featured],
  );

  useEffect(() => {
    if (!featuredCarouselApi || featured.length < 2) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const autoScroll = featuredCarouselApi.plugins().autoScroll;
    const syncAutoScroll = () => {
      if (reducedMotion.matches || document.visibilityState !== "visible") autoScroll.stop();
      else autoScroll.play(0);
    };
    syncAutoScroll();
    reducedMotion.addEventListener("change", syncAutoScroll);
    document.addEventListener("visibilitychange", syncAutoScroll);
    return () => {
      autoScroll.stop();
      reducedMotion.removeEventListener("change", syncAutoScroll);
      document.removeEventListener("visibilitychange", syncAutoScroll);
    };
  }, [featuredCarouselApi, featured.length]);

  useEffect(() => {
    setLoginOpen(auth === "login");
    setRegisterOpen(auth === "register");
    setPasswordResetOpen(auth === "reset");
  }, [auth]);

  const clearAuthSearch = () => navigate({ to: "/", search: {} });

  useEffect(() => {
    let mounted = true;
    const loadAccount = () => {
      void getCurrentSessionUser()
        .then((user) => {
          if (mounted) setAccount(user);
        })
        .catch(() => {
          if (mounted) setAccount(null);
        });
    };
    loadAccount();
    window.addEventListener(authSessionChangedEvent, loadAccount);
    return () => {
      mounted = false;
      window.removeEventListener(authSessionChangedEvent, loadAccount);
    };
  }, []);

  const loadFeatured = useCallback(async () => {
    try {
      const listings = await getMarketplaceListings();
      const sorted = [...listings].sort((a, b) => {
        const stockDifference = availableQuantity(b) - availableQuantity(a);
        return stockDifference || a.name.localeCompare(b.name);
      });
      setFeatured(
        sorted.slice(0, 8).map((listing) => ({
          ...listing,
          image: listing.image || marketplaceImageFor(listing.name),
        })),
      );
    } finally {
      setFeaturedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeatured().catch(() => undefined);
  }, [loadFeatured]);
  useAutoRefresh(() => loadFeatured().catch(() => undefined));

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    void navigate({
      to: "/marketplace",
      search: { q: heroQuery.trim() || undefined },
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        sessionAccount={account}
        onLogin={() => setLoginOpen(true)}
        onRegister={() => setRegisterOpen(true)}
      />

      <main>
        <section className="border-b border-border/70 bg-cream py-8 dark:bg-forest sm:py-12">
          <div className="grid w-full items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12 lg:px-8">
            <div className="py-4 text-foreground dark:text-forest-foreground sm:py-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary dark:border-white/20 dark:bg-white/10 dark:text-forest-foreground">
                <Sprout className="size-3.5" /> Fresh from PROCY farmer members
              </span>
              <h1 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.03] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                Fresh local produce, ready for pickup.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground dark:text-forest-foreground/75 md:text-lg">
                Compare Good, Semi, and Reject options, check live stock, and place your order with
                PROCY.
              </p>

              <form
                onSubmit={submitSearch}
                className="mt-7 flex max-w-2xl flex-col gap-2 sm:flex-row"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={heroQuery}
                    onChange={(event) => setHeroQuery(event.target.value)}
                    placeholder="Search vegetables, fruits, eggs…"
                    aria-label="Search marketplace products"
                    className="h-14 rounded-full bg-card pl-12 pr-5 text-base shadow-card"
                  />
                </div>
                <Button type="submit" size="lg" className="h-14 rounded-full px-7">
                  Search products
                </Button>
              </form>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full px-6">
                  <Link to="/marketplace" search={{ available: true }}>
                    Shop available products <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-border/80 bg-card/80 px-6"
                >
                  <Link to="/daily-prices">View daily prices</Link>
                </Button>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground dark:text-forest-foreground/65">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-primary" /> Quality classified
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <PackageCheck className="size-4 text-primary" /> Live stock
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Store className="size-4 text-primary" /> Fulfilled by PROCY
                </span>
              </div>

              {isBuyer ? (
                <div className="mt-7 flex max-w-2xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-card/90 p-4 text-card-foreground shadow-card">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-primary">Welcome back</p>
                    <p className="mt-1 font-semibold">{buyerName}, continue your Buyer journey.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" className="rounded-full">
                      <Link to="/buyer/cart">My cart</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <Link to="/buyer/orders">Track orders</Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-card shadow-field sm:rounded-[2.5rem]">
              <img
                src={landingPlaceholder}
                alt="Replaceable AgriLink landing page photo placeholder"
                width={960}
                height={800}
                fetchPriority="high"
                className="aspect-[6/5] w-full object-cover"
              />
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-2 text-xs font-medium text-foreground shadow-card backdrop-blur">
                <ImageIcon className="size-4 text-primary" /> Replaceable landing photo
              </div>
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/25 bg-forest/90 p-4 text-forest-foreground shadow-field backdrop-blur sm:p-5">
                <p className="text-xs uppercase tracking-[0.14em] opacity-70">Live marketplace</p>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold">
                      {featuredLoading
                        ? "Loading products…"
                        : `${availableFeatured} featured products available`}
                    </p>
                    <p className="mt-1 text-xs opacity-70">Stock refreshes automatically.</p>
                  </div>
                  <PackageCheck className="size-7 text-lime" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="w-full px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8"
          aria-label="Shop by category"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((category, index) => (
              <Link
                key={category.label}
                to="/marketplace"
                search={category.search}
                className={`group flex min-h-24 items-center gap-3 rounded-2xl border p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-field ${
                  index === 0
                    ? "col-span-2 border-primary/25 bg-primary/10 sm:col-span-1"
                    : "border-border bg-card"
                }`}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <category.icon className="size-5" />
                </span>
                <span className="text-sm font-semibold">{category.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16 w-full px-4 sm:mt-20 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                · Available now
              </p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Fresh products today</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                In-stock products appear first. Prices and quantities update automatically.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Products glide continuously. Pause by hovering or swipe to explore.
              </p>
            </div>
            <Button asChild variant="outline" className="w-fit rounded-full">
              <Link to="/marketplace" search={{ available: true }}>
                Explore full marketplace <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {featuredLoading ? (
            <div
              className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              role="status"
              aria-label="Loading featured products"
            >
              <FeaturedSkeleton />
              <FeaturedSkeleton />
              <FeaturedSkeleton />
            </div>
          ) : featured.length > 0 ? (
            <div
              ref={featuredCarouselRef}
              className="mt-8 cursor-grab overflow-hidden active:cursor-grabbing"
              role="region"
              aria-label="Featured produce carousel"
              aria-roledescription="carousel"
            >
              <div className="flex touch-pan-y gap-4 sm:gap-6">
                {featured.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex shrink-0 basis-[86%] snap-start sm:basis-[54%] lg:basis-[31%] xl:basis-[24%] [&>a]:w-full"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${index + 1} of ${featured.length}`}
                  >
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground sm:hidden">
                Swipe left or right to browse available products
              </p>
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No products are currently available.
            </div>
          )}
        </section>

        <section className="mt-20 w-full px-4 sm:mt-24 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            · Simple ordering
          </p>
          <h2 className="mt-3 text-3xl font-semibold md:text-4xl">From product to pickup</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {orderSteps.map((step, index) => (
              <div
                key={step.title}
                className="relative rounded-3xl border border-border bg-card p-6 shadow-card"
              >
                <span className="absolute right-5 top-5 text-xs font-semibold text-muted-foreground">
                  0{index + 1}
                </span>
                <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <step.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 w-full px-4 sm:mt-24 sm:px-6 lg:px-8">
          <div className="grid gap-8 overflow-hidden rounded-[2rem] surface-field p-7 md:grid-cols-[0.9fr_1.1fr] md:p-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
                · Clear quality choices
              </p>
              <h2 className="mt-4 text-3xl font-semibold md:text-4xl">
                One product, selectable quality options
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed opacity-80">
                Each permanent product listing may offer Good, Semi, and Reject. Buyers compare the
                photo, price, and available stock before adding their preferred quality to cart.
              </p>
              <Button asChild variant="secondary" className="mt-7 rounded-full">
                <Link to="/marketplace" search={{}}>
                  Compare live products <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="space-y-3">
              {[
                {
                  grade: "Good",
                  detail: "Best appearance and quality",
                  tone: "bg-emerald-500/15",
                },
                {
                  grade: "Semi",
                  detail: "Usable produce at a different price",
                  tone: "bg-amber-400/15",
                },
                {
                  grade: "Reject",
                  detail: "Lower grade, clearly identified",
                  tone: "bg-orange-500/15",
                },
              ].map((item) => (
                <div
                  key={item.grade}
                  className={`flex items-center justify-between gap-4 rounded-2xl border border-white/15 p-5 ${item.tone}`}
                >
                  <div>
                    <p className="font-semibold">{item.grade} quality</p>
                    <p className="mt-1 text-xs opacity-70">{item.detail}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <Check className="size-4" /> Selectable
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-20 w-full px-4 sm:mt-24 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {trustPoints.map((point) => (
              <div
                key={point.title}
                className="flex gap-4 rounded-3xl border border-border bg-card p-6 shadow-card"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <point.icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl bg-muted/60 px-5 py-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="size-4" /> Stock refreshed from receiving records
            </span>
            <span className="inline-flex items-center gap-2">
              <Truck className="size-4" /> Pickup details shown after confirmation
            </span>
          </div>
        </section>

        <section className="mt-20 w-full px-4 sm:mt-24 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-border bg-cream p-8 text-center dark:bg-card md:p-14">
            <h2 className="text-3xl font-semibold md:text-4xl">
              {isBuyer ? "Continue your AgriLink order" : "Ready to buy from PROCY?"}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              {isBuyer
                ? "Review your reserved products or track the latest status of your submitted orders."
                : "Browse freely, then register as a Buyer when you are ready to reserve stock and submit an order."}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {isBuyer ? (
                <>
                  <Button asChild size="lg" className="rounded-full">
                    <Link to="/buyer/cart">My cart</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="rounded-full">
                    <Link to="/buyer/orders">My orders</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    size="lg"
                    className="rounded-full"
                    onClick={() => setRegisterOpen(true)}
                  >
                    Register
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setLoginOpen(true)}
                  >
                    I already have an account
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter sessionSignedIn={Boolean(account)} />
      <LoginDialog
        open={loginOpen}
        onOpenChange={(open) => {
          setLoginOpen(open);
          if (!open) clearAuthSearch();
        }}
        onRegister={() => setRegisterOpen(true)}
        onForgotPassword={() => setPasswordResetOpen(true)}
      />
      <RegisterDialog
        open={registerOpen}
        onOpenChange={(open) => {
          setRegisterOpen(open);
          if (!open) clearAuthSearch();
        }}
        onLogin={() => setLoginOpen(true)}
      />
      <PasswordResetDialog
        open={passwordResetOpen}
        onOpenChange={(open) => {
          setPasswordResetOpen(open);
          if (!open) clearAuthSearch();
        }}
        onLogin={() => setLoginOpen(true)}
      />
    </div>
  );
}
