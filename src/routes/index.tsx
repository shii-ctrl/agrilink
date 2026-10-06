import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardCheck,
  LineChart,
  LockKeyhole,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import heroImg from "@/assets/hero-farm.jpg";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/products";
import { getCurrentSessionUser } from "@/lib/auth-functions";
import { marketplaceImageFor } from "@/lib/marketplace-images";
import { getMarketplaceListings } from "@/lib/marketplace-server-functions";

export const Route = createFileRoute("/")({
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
    body: "Farmer members supply their harvests to PROCY and can view their own production records.",
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
  const [isBuyer, setIsBuyer] = useState(false);
  const [featured, setFeatured] = useState<Product[]>([]);
  useEffect(() => {
    void getCurrentSessionUser()
      .then((user) => {
        setIsBuyer(Boolean(user?.roles.includes("Buyer")));
      })
      .catch(() => setIsBuyer(false));
  }, []);
  useEffect(() => {
    void getMarketplaceListings().then((listings) => {
      setFeatured(
        listings
          .filter((listing) => listing.classification === "Good")
          .slice(0, 3)
          .map((listing) => ({ ...listing, image: marketplaceImageFor(listing.name) })),
      );
    });
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

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
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/40 bg-white/10 px-6 text-forest-foreground hover:bg-white/20 hover:text-forest-foreground"
                >
                  <Link to={isBuyer ? "/buyer/cart" : "/login"}>
                    {isBuyer ? "Open my cart" : "Login"}
                  </Link>
                </Button>
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
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/marketplace">View all products</Link>
            </Button>
          </div>
          {featured.length > 0 ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
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
              <Button asChild size="lg" className="rounded-full">
                <Link to={isBuyer ? "/buyer/cart" : "/register"}>
                  {isBuyer ? "My cart" : "Register as Buyer"}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to={isBuyer ? "/buyer/orders" : "/login"}>
                  {isBuyer ? "My orders" : "I already have an account"}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
