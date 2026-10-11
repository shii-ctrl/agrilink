import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About AgriLink & PROCY — How the Marketplace Works" },
      {
        name: "description",
        content:
          "AgriLink connects farmer members with PROCY, the seller and market operator that classifies, publishes, and fulfills every order.",
      },
      { property: "og:title", content: "About AgriLink & PROCY" },
      {
        property: "og:description",
        content: "How farmer members, PROCY, and buyers work together on AgriLink.",
      },
    ],
  }),
  component: AboutPage,
});

const roles = [
  {
    role: "Management",
    body: "Creates and manages all internal accounts and oversees operations.",
  },
  { role: "Marketer", body: "Publishes and maintains marketplace listings and pricing." },
  { role: "Accounting", body: "Records payments and marks confirmed orders as paid." },
  {
    role: "Farmer Member",
    body: "Supplies harvests to PROCY and views their own production records.",
  },
  { role: "Farm Consultant", body: "Advises farmer members privately and through community chat." },
  { role: "Buyer", body: "Self-registers, purchases from PROCY, and tracks their own orders." },
];

function AboutPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">· About</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold md:text-5xl">
          AgriLink is a web-based marketplace and decision support system for local farmers
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground">
          Traditional farming remains labor-intensive and disconnected from market demand. AgriLink
          links farmer members, PROCY personnel, consultants, and buyers in one coordinated system —
          from delivery intake and quality classification to order fulfillment and demand insight.
        </p>

        <section className="mt-16 grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] surface-field p-8">
            <h2 className="text-2xl font-semibold">PROCY is the seller</h2>
            <p className="mt-4 text-sm opacity-85">
              Farmer members supply agricultural products to PROCY. PROCY classifies, prices, and
              publishes them, and buyers purchase from PROCY. There is no direct farmer-to-buyer
              selling on AgriLink.
            </p>
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-8 shadow-card">
            <h2 className="text-2xl font-semibold">Order and payment lifecycle</h2>
            <ol className="mt-5 space-y-3 text-sm text-muted-foreground">
              {[
                "Buyer places an order → Order status: Pending",
                "PROCY confirms it → Order status: Confirmed; sales status: Sold",
                "Accounting records payment → Payment status: Paid",
                "Buyer orders automatically provide demand data for decision support",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] border border-border bg-card p-8 shadow-card">
            <h2 className="text-2xl font-semibold">Clear product classifications</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              PROCY records each delivery as Good, Semi, and Reject quantities. Each classification
              is a separate inventory and marketplace listing, so buyers can see exactly what is
              available.
            </p>
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-8 shadow-card">
            <h2 className="text-2xl font-semibold">Information for better decisions</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              AgriLink brings together production, harvest, supply, demand, price, and sales
              information. Its decision support is a reference for planning, not a guarantee of
              prices, buyers, harvests, sales, or profit.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-3xl font-semibold">Roles in the system</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => (
              <div
                key={r.role}
                className="rounded-3xl border border-border bg-card p-6 shadow-card"
              >
                <h3 className="text-lg font-semibold">{r.role}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{r.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Only buyer accounts can self-register. Management creates all other accounts.
          </p>
        </section>

        <section className="mt-20 rounded-[2rem] border border-border bg-cream p-10 text-center">
          <h2 className="text-3xl font-semibold">Start browsing the marketplace</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/marketplace">Browse products</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/register">Register as Buyer</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
