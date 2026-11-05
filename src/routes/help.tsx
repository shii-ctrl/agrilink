import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleAlert, MessageCircle, PackageSearch, ShoppingCart } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help — AgriLink" },
      { name: "description", content: "Buyer support for AgriLink orders and marketplace use." },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const supportLinks = [
    {
      icon: PackageSearch,
      title: "Find products",
      text: "Search available products by crop type, quality, and stock.",
      to: "/marketplace" as const,
    },
    {
      icon: ShoppingCart,
      title: "Review your cart",
      text: "Check quantities, totals, and your pickup or delivery details.",
      to: "/buyer/cart" as const,
    },
    {
      icon: CircleAlert,
      title: "Report an issue",
      text: "Submit a concern about an eligible delivered order.",
      to: "/buyer/issues" as const,
    },
    {
      icon: MessageCircle,
      title: "Contact support",
      text: "Open your private messages for order assistance.",
      to: "/buyer/community" as const,
    },
  ];
  const faq = [
    [
      "Can I buy directly from farmers?",
      "Products are supplied by PROCY farmer members and sold through PROCY.",
    ],
    [
      "What do Good, Semi, and Reject mean?",
      "They are quality options with separate photos, prices, and available quantities.",
    ],
    [
      "How do I track an order?",
      "Sign in and open My Orders to view the latest order, payment, pickup, or delivery status.",
    ],
  ];
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="w-full px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Help center</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold md:text-5xl">Buyer support</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Find products, manage orders, and get help with your purchases.
        </p>
        <section className="mt-10 grid gap-5 md:grid-cols-2">
          {supportLinks.map((item) => (
            <Link
              key={item.title}
              to={item.to}
              className="rounded-3xl border border-border bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-field"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <item.icon className="size-5" />
              </span>
              <h2 className="mt-5 text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </Link>
          ))}
        </section>
        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-xl font-semibold">Frequently asked questions</h2>
          <div className="mt-5 divide-y divide-border">
            {faq.map(([question, answer]) => (
              <details key={question} className="py-4">
                <summary className="cursor-pointer font-semibold">{question}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="mt-8 rounded-3xl border border-primary/20 bg-accent p-6 text-accent-foreground">
          <h2 className="text-lg font-semibold">Looking for something?</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Browse the marketplace to check current products, prices, and availability.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/marketplace">Browse marketplace</Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
