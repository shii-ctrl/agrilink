import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { getCurrentSessionUser } from "@/services/auth/auth-functions";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About AgriLink & PROCY" },
      {
        name: "description",
        content:
          "AgriLink connects buyers with fresh, quality-classified produce supplied by PROCY farmer members.",
      },
      { property: "og:title", content: "About AgriLink & PROCY" },
      {
        property: "og:description",
        content:
          "Fresh local produce, clear quality options, and convenient ordering through PROCY.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const [account, setAccount] = useState<
    Awaited<ReturnType<typeof getCurrentSessionUser>> | undefined
  >(undefined);
  const isBuyer = Boolean(account?.roles.includes("Buyer"));

  useEffect(() => {
    void getCurrentSessionUser()
      .then(setAccount)
      .catch(() => setAccount(null));
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="w-full px-4 pt-10 sm:px-6 sm:pt-12 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">· About</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold md:text-5xl">
          Fresh local produce, made easier to find and order
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground">
          AgriLink is PROCY&apos;s online marketplace for quality-classified agricultural products
          supplied by local farmer members.
        </p>

        <section className="mt-16 grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] surface-field p-8">
            <h2 className="text-2xl font-semibold">Farmer-member produce</h2>
            <p className="mt-4 text-sm opacity-85">
              Browse vegetables, fruits, eggs, and other agricultural products supplied by PROCY
              farmer members.
            </p>
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-8 shadow-card">
            <h2 className="text-2xl font-semibold">Clear quality options</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Compare Good, Semi, and Reject options using their photos, prices, and available
              quantities.
            </p>
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] border border-border bg-card p-8 shadow-card">
            <h2 className="text-2xl font-semibold">Current prices and availability</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Check current marketplace stock and compare daily prices before placing an order.
            </p>
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-8 shadow-card">
            <h2 className="text-2xl font-semibold">Pickup or delivery</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Choose your preferred option at checkout and track your order from confirmation to
              completion.
            </p>
          </div>
        </section>

        <section className="mt-20 rounded-[2rem] border border-border bg-cream p-10 text-center">
          <h2 className="text-3xl font-semibold">Start browsing the marketplace</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/marketplace">Browse products</Link>
            </Button>
            {account === null ? (
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/register">Register</Link>
              </Button>
            ) : isBuyer ? (
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/buyer/orders">My orders</Link>
              </Button>
            ) : null}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
