import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleHelp, LogIn, ShoppingCart, Sprout } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help — AgriLink" },
      { name: "description", content: "Learn how to browse and use the AgriLink marketplace." },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const steps = [
    {
      icon: Sprout,
      title: "Browse products",
      text: "Open Marketplace to view products supplied by farmer members and managed by PROCY. Use search and filters to find what you need.",
    },
    {
      icon: CircleHelp,
      title: "Understand classifications",
      text: "Each product is listed separately as Good, Semi, or Reject. The Vegetable Classification Guide explains the crop types.",
    },
    {
      icon: LogIn,
      title: "Create or use a Buyer account",
      text: "You may browse freely. Login or Register as Buyer is required before adding products to a cart or placing an order.",
    },
    {
      icon: ShoppingCart,
      title: "Place an order",
      text: "Add available products to your cart, review the quantity, and submit your order. PROCY confirms orders; AgriLink has no online payment gateway.",
    },
  ];
  const faq = [
    [
      "Can I buy directly from farmers?",
      "No. Farmers supply PROCY, and PROCY lists and sells products to buyers.",
    ],
    [
      "What do Good, Semi, and Reject mean?",
      "They are separate PROCY quality classifications. Each has its own listing, price, and available quantity.",
    ],
    [
      "How do I track an order?",
      "Sign in as a Buyer and open My Orders to see Pending, Confirmed, Sold, and Paid progress.",
    ],
  ];
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Help center</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold md:text-5xl">How to use AgriLink</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          A simple guide for visitors and buyers using the PROCY marketplace.
        </p>
        <section className="mt-10 grid gap-5 md:grid-cols-2">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-3xl border border-border bg-card p-6 shadow-card"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <step.icon className="size-5" />
              </span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-primary">
                Step {index + 1}
              </p>
              <h2 className="mt-1 text-xl font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </article>
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
          <h2 className="text-lg font-semibold">Who manages the marketplace?</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Farmer Members supply PROCY. PROCY receives, classifies, lists, and sells products to
            buyers. Buyers do not purchase directly from individual farmers.
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
