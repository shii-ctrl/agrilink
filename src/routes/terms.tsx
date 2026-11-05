import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — AgriLink" },
      { name: "description", content: "Rules for using the AgriLink marketplace." },
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
        <p className="mt-4 text-muted-foreground">Last updated: November 5, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">Marketplace information</h2>
            <p className="mt-2">
              Product availability and prices may change. Review the product, quantity, total, and
              pickup or delivery details before confirming an order.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Account responsibility</h2>
            <p className="mt-2">
              Keep your password private and provide accurate account and delivery information.
              Contact PROCY if you lose access or notice activity you do not recognize.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Orders and payment</h2>
            <p className="mt-2">
              Orders are subject to product availability and confirmation. Follow the payment,
              pickup, or delivery instructions shown with your order.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Security and availability</h2>
            <p className="mt-2">
              Do not access another person&apos;s account, interfere with AgriLink, or submit false
              or misleading information. Access may be limited when needed to protect users and the
              service.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
