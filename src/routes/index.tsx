import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardCheck,
  Clock3,
  Egg,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Store,
  Tags,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { z } from "zod";
import procyHero from "@/assets/procy-market-hero-cover.jpg";
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
  avatarUrl: string | null;
};

const categories = [
  { label: "Available today", icon: PackageCheck, search: { available: true } },
  { label: "Vegetables", icon: Sprout, search: { q: "crops", available: true } },
  { label: "Fruits", icon: Tags, search: { crop: "Fruits", available: true } },
  { label: "Eggs", icon: Egg, search: { q: "itlog", available: true } },
  { label: "Bundle deals", icon: ShoppingBag, search: { deals: true, available: true } },
] as const;

const assurancePoints = [
  {
    icon: Clock3,
    title: "Stock reservation",
    body: "Cart quantities are reserved for 10 minutes during checkout.",
  },
  {
    icon: ClipboardCheck,
    title: "Order verification",
    body: "PROCY reviews product availability before confirming each order.",
  },
  {
    icon: ShieldCheck,
    title: "Tracking and support",
    body: "Track fulfillment progress and report delivery or product concerns.",
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

      <main className="overflow-x-clip">
        <section className="relative isolate overflow-hidden border-b border-border/70 bg-cream dark:bg-forest sm:min-h-[680px]">
          <img
            src={procyHero}
            alt="Sentrong Pamilihan ng Produktong Agrikultura sa Quezon"
            width={1920}
            height={1080}
            fetchPriority="high"
            className="absolute inset-0 -z-30 h-full w-full object-cover object-[68%_center] sm:object-center"
          />
          <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(250,250,242,0.97)_0%,rgba(250,250,242,0.88)_58%,rgba(250,250,242,0.72)_100%)] dark:bg-[linear-gradient(180deg,rgba(7,45,26,0.97)_0%,rgba(7,45,26,0.9)_58%,rgba(7,45,26,0.78)_100%)] sm:bg-[linear-gradient(90deg,rgba(250,250,242,0.98)_0%,rgba(250,250,242,0.94)_38%,rgba(250,250,242,0.62)_58%,rgba(250,250,242,0.14)_82%,rgba(250,250,242,0.05)_100%)] sm:dark:bg-[linear-gradient(90deg,rgba(7,45,26,0.98)_0%,rgba(7,45,26,0.94)_38%,rgba(7,45,26,0.7)_60%,rgba(7,45,26,0.18)_88%,rgba(7,45,26,0.08)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-background/95" />

          <div className="grid w-full items-start gap-7 px-4 pb-8 pt-6 sm:min-h-[680px] sm:gap-8 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-center lg:gap-12 lg:px-8">
            <div className="min-w-0 max-w-3xl text-foreground dark:text-forest-foreground">
              <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-card/85 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary shadow-sm backdrop-blur-md dark:border-white/20 dark:bg-forest/70 dark:text-forest-foreground sm:px-4 sm:text-xs sm:tracking-[0.14em]">
                <Sprout className="size-3.5" /> Fresh from PROCY farmer members
              </span>
              <h1 className="mt-4 max-w-3xl font-display text-[2rem] font-semibold leading-[1.06] tracking-tight min-[430px]:text-[2.25rem] sm:mt-6 sm:text-5xl md:text-6xl lg:text-7xl">
                Fresh local produce, ready when you are.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/70 dark:text-forest-foreground/80 sm:mt-5 sm:text-base md:text-lg">
                Compare Good, Semi, and Reject quality options, check live stock, and order for
                pickup or delivery from PROCY.
              </p>

              <form
                onSubmit={submitSearch}
                className="mt-6 flex max-w-2xl flex-col gap-2 sm:mt-7 sm:flex-row"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={heroQuery}
                    onChange={(event) => setHeroQuery(event.target.value)}
                    placeholder="Search vegetables, fruits, eggs, and more…"
                    aria-label="Search marketplace products"
                    className="h-12 rounded-full border-white/70 bg-card/90 pl-11 pr-4 text-sm shadow-card backdrop-blur-md sm:h-14 sm:pl-12 sm:pr-5 sm:text-base"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-full px-7 sm:h-14 sm:w-auto"
                >
                  Search products
                </Button>
              </form>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:mt-4 sm:flex sm:flex-wrap sm:gap-3">
                <Button asChild size="lg" className="w-full rounded-full px-4 sm:w-auto sm:px-6">
                  <Link to="/marketplace" search={{ available: true }}>
                    Browse available products <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full border-white/70 bg-card/85 px-4 backdrop-blur-md sm:w-auto sm:px-6"
                >
                  <Link to="/daily-prices">View today&apos;s prices</Link>
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-foreground/70 dark:text-forest-foreground/75 sm:mt-6 sm:flex sm:flex-wrap sm:gap-x-5">
                <span className="col-span-2 inline-flex items-center gap-1.5 sm:col-span-1">
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
                <div className="mt-6 flex max-w-2xl flex-col items-stretch justify-between gap-4 rounded-2xl border border-primary/20 bg-card/90 p-4 text-card-foreground shadow-card sm:mt-7 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-primary">Welcome back</p>
                    <p className="mt-1 font-semibold">{buyerName}, continue your Buyer journey.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2 sm:flex sm:flex-wrap">
                    <Button asChild size="sm" className="w-full rounded-full sm:w-auto">
                      <Link to="/buyer/cart">My cart</Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full rounded-full sm:w-auto"
                    >
                      <Link to="/buyer/orders">Track orders</Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-w-0 self-end pb-2 lg:justify-self-end lg:pb-8">
              <div className="w-full rounded-2xl border border-white/25 bg-forest/90 p-4 text-forest-foreground shadow-field backdrop-blur-md sm:max-w-md sm:p-5 lg:min-w-[360px]">
                <p className="text-xs uppercase tracking-[0.14em] opacity-70">Live marketplace</p>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold sm:text-xl">
                      {featuredLoading
                        ? "Loading products…"
                        : `${availableFeatured} featured products available`}
                    </p>
                    <p className="mt-1 text-xs opacity-70">Stock refreshes automatically.</p>
                  </div>
                  <PackageCheck className="size-5 shrink-0 text-lime sm:size-7" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="w-full px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8"
          aria-label="Shop by category"
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {categories.map((category, index) => (
              <Link
                key={category.label}
                to="/marketplace"
                search={category.search}
                className={`group flex min-h-20 items-center gap-2.5 rounded-2xl border p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-field sm:min-h-24 sm:gap-3 sm:p-4 ${
                  index === 0
                    ? "col-span-2 border-primary/25 bg-primary/10 sm:col-span-1"
                    : "border-border bg-card"
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground sm:size-10">
                  <category.icon className="size-4.5 sm:size-5" />
                </span>
                <span className="text-xs font-semibold sm:text-sm">{category.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 w-full px-4 sm:mt-20 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                · Current market availability
              </p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
                Available agricultural products
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Prices and stock quantities reflect the latest records published by PROCY.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full rounded-full sm:w-fit">
              <Link to="/marketplace" search={{ available: true }}>
                Explore full marketplace <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {featuredLoading ? (
            <div
              className="mt-6 grid gap-5 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3"
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
              className="mt-6 cursor-grab overflow-hidden active:cursor-grabbing sm:mt-8"
              role="region"
              aria-label="Featured produce carousel"
              aria-roledescription="carousel"
            >
              <div className="flex touch-pan-y gap-4 sm:gap-6">
                {featured.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex shrink-0 basis-[92%] snap-start min-[430px]:basis-[82%] sm:basis-[54%] lg:basis-[31%] xl:basis-[24%] [&>a]:w-full"
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

        <section className="mt-14 w-full px-4 sm:mt-24 sm:px-6 lg:px-8">
          <div className="grid gap-6 overflow-hidden rounded-3xl surface-field p-5 sm:gap-8 sm:rounded-[2rem] sm:p-7 md:grid-cols-[0.9fr_1.1fr] md:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
                · PROCY quality classifications
              </p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl md:text-4xl">
                Compare available quality options
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed opacity-80">
                Products may be offered in Good, Semi, or Reject classifications. Photos, prices,
                and available quantities are shown separately for informed purchasing.
              </p>
              <Button
                asChild
                variant="secondary"
                className="mt-5 w-full rounded-full sm:mt-6 sm:w-auto"
              >
                <Link to="/marketplace" search={{}}>
                  Browse classified products <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="space-y-2.5">
              {[
                {
                  grade: "Good",
                  detail: "Best overall appearance and condition",
                  tone: "bg-emerald-500/15",
                },
                {
                  grade: "Semi",
                  detail: "Usable produce with minor visual imperfections",
                  tone: "bg-amber-400/15",
                },
                {
                  grade: "Reject",
                  detail: "Lower-grade produce offered at a reduced price",
                  tone: "bg-orange-500/15",
                },
              ].map((item) => (
                <div
                  key={item.grade}
                  className={`rounded-2xl border border-white/15 px-4 py-3.5 sm:px-5 ${item.tone}`}
                >
                  <p className="font-semibold">{item.grade}</p>
                  <p className="mt-0.5 text-xs opacity-70">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 w-full px-4 sm:mt-16 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            · Buyer assurance
          </p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
            Reliable ordering through PROCY
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {assurancePoints.map((point) => (
              <div
                key={point.title}
                className="flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <point.icon className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{point.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{point.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 w-full px-4 sm:mt-16 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border bg-cream px-5 py-7 text-center dark:bg-card sm:rounded-[2rem] sm:px-8 sm:py-9">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              {isBuyer ? "Continue your AgriLink order" : "Order fresh produce from PROCY"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {isBuyer
                ? "Review your reserved products or track the latest status of your submitted orders."
                : "Create a Buyer account to reserve available stock and choose pickup or delivery."}
            </p>
            <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
              {isBuyer ? (
                <>
                  <Button asChild size="lg" className="w-full rounded-full sm:w-auto">
                    <Link to="/buyer/cart">My cart</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="w-full rounded-full sm:w-auto"
                  >
                    <Link to="/buyer/orders">My orders</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    size="lg"
                    className="w-full rounded-full sm:w-auto"
                    onClick={() => setRegisterOpen(true)}
                  >
                    Create an account
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="w-full rounded-full sm:w-auto"
                    onClick={() => setLoginOpen(true)}
                  >
                    Sign in
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
