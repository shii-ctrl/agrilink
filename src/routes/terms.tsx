import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — AgriLink" },
      { name: "description", content: "Rules for using the AgriLink prototype marketplace." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-14 md:px-8">
        <p className="text-sm font-medium text-primary">AGRILINK</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Terms of use</h1>
        <p className="mt-4 text-muted-foreground">Last updated: October 6, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">Prototype service</h2>
            <p className="mt-2">
              AgriLink is a prototype marketplace and decision-support system. Use only accurate
              information and do not treat prototype listings, prices, or payment records as a
              substitute for a signed commercial agreement.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Account responsibility</h2>
            <p className="mt-2">
              Keep your password private, use the account assigned to you, and report lost access to
              Management. Management may suspend accounts that are inactive, compromised, or used
              outside their assigned role.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Marketplace workflow</h2>
            <p className="mt-2">
              Farmer members supply products to PROCY. Authorized PROCY personnel record delivery,
              classification, listing, order fulfillment, and payment information. Buyers purchase
              from PROCY, not directly from individual farmer members.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Security and availability</h2>
            <p className="mt-2">
              Do not attempt to access another person’s account, change data outside your role, or
              bypass system controls. Service availability, stock, and account access may change
              while Management maintains the prototype.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
