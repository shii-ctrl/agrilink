import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  LineChart,
  LockKeyhole,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { z } from "zod";
import heroImg from "@/assets/hero-farm.jpg";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/")({
  validateSearch: z.object({
    auth: z.enum(["login", "register", "reset"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "AgriLink — Marketplace & Decision Support for Local Farmers" },
      {
        name: "description",
        content:
          "Browse agricultural products supplied by local farmer members and managed by PROCY, the market operator and seller.",
      },
      { property: "og:title", content: "AgriLink — Marketplace for Local Farm Produce" },
      {
        property: "og:description",
        content:
          "Browse agricultural products supplied by local farmer members and managed by PROCY.",
      },
    ],
  }),
  component: Index,
});

const marketplaceNotes = [
  {
    icon: Search,
    title: "Browse publicly",
    body: "Explore available agricultural products without an account.",
  },
  {
    icon: LockKeyhole,
    title: "Sign in to purchase",
    body: "Buyer registration or login is required before adding items to cart or placing an order.",
  },
  {
    icon: ShoppingCart,
    title: "Orders confirmed by PROCY",
    body: "Orders are submitted for PROCY confirmation; online payment is not processed on AgriLink.",
  },
];

const pillars = [
  {
    icon: Users,
    title: "Farmer members",
    body: "Farmer members supply their harvests to PROCY and can view their own receiving history.",
  },
  {
    icon: ClipboardCheck,
    title: "Quality classification",
    body: "Every delivery is split into Good, Semi, and Reject — each listed and priced separately.",
  },
  {
    icon: ShieldCheck,
    title: "PROCY as seller",
    body: "PROCY publishes, prices, and fulfills every order. No direct farmer-to-buyer selling.",
  },
  {
    icon: LineChart,
    title: "Decision support",
    body: "Production, supply, demand, price, and sales records provide information for better decisions.",
  },
];

function Index() {
  const navigate = useNavigate();
  const { auth } = Route.useSearch();
  const [isBuyer, setIsBuyer] = useState(false);
  const [featured, setFeatured] = useState<Product[]>([]);
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
    {
      align: "start",
      containScroll: "trimSnaps",
      dragFree: true,
      loop: true,
    },
    [featuredAutoScroll],
  );
  const [canScrollFeaturedPrev, setCanScrollFeaturedPrev] = useState(false);
  const [canScrollFeaturedNext, setCanScrollFeaturedNext] = useState(false);
  const updateFeaturedCarouselControls = useCallback(() => {
    if (!featuredCarouselApi) return;
    setCanScrollFeaturedPrev(featuredCarouselApi.canScrollPrev());
    setCanScrollFeaturedNext(featuredCarouselApi.canScrollNext());
  }, [featuredCarouselApi]);

  useEffect(() => {
    if (!featuredCarouselApi) return;
    updateFeaturedCarouselControls();
    featuredCarouselApi.on("select", updateFeaturedCarouselControls);
    featuredCarouselApi.on("reInit", updateFeaturedCarouselControls);
    return () => {
      featuredCarouselApi.off("select", updateFeaturedCarouselControls);
      featuredCarouselApi.off("reInit", updateFeaturedCarouselControls);
    };
  }, [featuredCarouselApi, updateFeaturedCarouselControls]);

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
    const loadBuyer = () => {
      void getCurrentSessionUser()
        .then((user) => {
          if (mounted) setIsBuyer(Boolean(user?.roles.includes("Buyer")));
        })
        .catch(() => {
          if (mounted) setIsBuyer(false);
        });
    };
    loadBuyer();
    window.addEventListener(authSessionChangedEvent, loadBuyer);
    return () => {
      mounted = false;
      window.removeEventListener(authSessionChangedEvent, loadBuyer);
    };
  }, []);
  useEffect(() => {
    void getMarketplaceListings().then((listings) => {
      setFeatured(
        listings
          .filter((listing) => listing.classification === "Good")
          .slice(0, 8)
          .map((listing) => ({
            ...listing,
            image: listing.image || marketplaceImageFor(listing.name),
          })),
      );
    });
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader onLogin={() => setLoginOpen(true)} onRegister={() => setRegisterOpen(true)} />

      <main>
        {/* Hero */}
        <section className="bg-cream px-4 pb-12 pt-8 dark:bg-forest sm:px-6 sm:pb-16 xl:px-8">
          <div className="relative mx-auto max-w-[1500px] overflow-hidden rounded-[2rem] shadow-field sm:rounded-[2.5rem]">
            <img
              src={heroImg}
              alt="Farmer walking through terraced vegetable fields at sunrise"
              width={1600}
              height={1008}
              className="h-[min(690px,calc(100svh-9.75rem))] min-h-[520px] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/75 to-forest/10" />
            <div className="absolute inset-0 bg-gradient-to-t from-forest/70 via-transparent to-transparent" />
            <div className="absolute inset-0 flex max-w-4xl flex-col justify-end p-7 text-forest-foreground sm:p-10 md:p-14 lg:p-16">
              <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide backdrop-blur">
                <Sprout className="size-3.5" /> Welcome to AgriLink
              </span>
              <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.04] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                A marketplace and decision support system for local farmers
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed opacity-90 md:text-lg">
                Browse agricultural products supplied by local farmer members and managed by PROCY.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 sm:mt-10">
                <Button asChild size="lg" className="rounded-full px-6">
                  <Link to="/marketplace">
                    Browse products <ArrowRight className="size-4" />
                  </Link>
                </Button>
                {isBuyer ? (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="rounded-full border-white/40 bg-white/10 px-6 text-forest-foreground hover:bg-white/20 hover:text-forest-foreground"
                  >
                    <Link to="/buyer/cart">Open my cart</Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={() => setLoginOpen(true)}
                    className="rounded-full border-white/40 bg-white/10 px-6 text-forest-foreground hover:bg-white/20 hover:text-forest-foreground"
                  >
                    Login
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Marketplace access */}
          <div className="mx-auto mt-7 grid max-w-[1500px] gap-4 md:grid-cols-3">
            {marketplaceNotes.map((note) => (
              <div
                key={note.title}
                className="rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-card backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.045] dark:text-forest-foreground"
              >
                <note.icon className="size-5 text-primary" aria-hidden="true" />
                <h2 className="mt-4 font-semibold">{note.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground dark:text-forest-foreground/65">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto mt-24 max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            · How AgriLink works
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold md:text-4xl">
            Farmer members supply.{" "}
            <span className="text-muted-foreground">
              PROCY classifies, publishes, and sells to buyers.
            </span>
          </h2>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="rounded-3xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-field"
              >
                <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <p.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Classification explainer */}
        <section className="mx-auto mt-24 max-w-6xl px-4">
          <div className="grid gap-8 overflow-hidden rounded-[2rem] surface-field p-8 md:grid-cols-2 md:p-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
                · Transparent product information
              </p>
              <h2 className="mt-4 text-3xl font-semibold md:text-4xl">
                One delivery, three grades
              </h2>
              <p className="mt-4 max-w-md text-sm opacity-85">
                A 100 kg tomato delivery is never listed as a single lot. PROCY records each grade
                separately so buyers know exactly what they are purchasing.
              </p>
              <Button asChild variant="secondary" className="mt-8 rounded-full">
                <Link to="/marketplace">
                  See live listings <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="space-y-3">
              {[
                { grade: "Good", qty: "70 kg", note: "A separate marketplace listing" },
                { grade: "Semi", qty: "20 kg", note: "A separate marketplace listing" },
                { grade: "Reject", qty: "10 kg", note: "A separate marketplace listing" },
              ].map((row, i) => (
                <div
                  key={row.grade}
                  className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs opacity-60">0{i + 1}</span>
                    <div>
                      <p className="font-semibold">Tomato — {row.grade}</p>
                      <p className="text-xs opacity-75">{row.note}</p>
                    </div>
                  </div>
                  <span className="font-display text-lg font-semibold">{row.qty}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured */}
        <section className="mx-auto mt-24 max-w-6xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                · Fresh on the market
              </p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Featured produce</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Live listings and availability from the AgriLink database.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="hidden rounded-full sm:inline-flex"
                onClick={() => featuredCarouselApi?.scrollPrev()}
                disabled={!canScrollFeaturedPrev}
                aria-label="Previous featured products"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="hidden rounded-full sm:inline-flex"
                onClick={() => featuredCarouselApi?.scrollNext()}
                disabled={!canScrollFeaturedNext}
                aria-label="Next featured products"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/marketplace">View all products</Link>
              </Button>
            </div>
          </div>
          {featured.length > 0 ? (
            <div
              ref={featuredCarouselRef}
              className="mt-8 cursor-grab overflow-hidden active:cursor-grabbing"
              role="region"
              aria-label="Featured produce carousel"
              aria-roledescription="carousel"
            >
              <div className="flex touch-pan-y gap-4 sm:gap-6">
                {featured.map((p, index) => (
                  <div
                    key={p.id}
                    className="flex shrink-0 basis-[86%] snap-start sm:basis-[54%] lg:basis-[36%] [&>a]:w-full"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${index + 1} of ${featured.length}`}
                  >
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground sm:hidden">
                Products glide continuously · Swipe left or right anytime
              </p>
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No agricultural products are currently available.
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="mx-auto mt-24 max-w-6xl px-4">
          <div className="rounded-[2rem] border border-border bg-cream p-8 text-center md:p-14">
            <h2 className="text-3xl font-semibold md:text-4xl">Ready to buy from PROCY?</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              {isBuyer
                ? "Your Buyer account is active. Review your cart or track your submitted orders."
                : "Anyone can browse the marketplace. Register as a buyer to add items to your cart, check out, and place orders."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {isBuyer ? (
                <Button asChild size="lg" className="rounded-full">
                  <Link to="/buyer/cart">My cart</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  className="rounded-full"
                  onClick={() => setRegisterOpen(true)}
                >
                  Register as Buyer
                </Button>
              )}
              {isBuyer ? (
                <Button asChild size="lg" variant="outline" className="rounded-full">
                  <Link to="/buyer/orders">My orders</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setLoginOpen(true)}
                >
                  I already have an account
                </Button>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
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
