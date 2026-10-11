import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — AgriLink" },
      { name: "description", content: "How AgriLink handles account and marketplace data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-14 md:px-8">
        <p className="text-sm font-medium text-primary">AGRILINK</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Privacy notice</h1>
        <p className="mt-4 text-muted-foreground">Last updated: October 6, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">Information we save</h2>
            <p className="mt-2">
              AgriLink saves account names, contact details, email addresses, role assignments,
              marketplace activity, delivery records, orders, payments, notifications, and audit
              records needed to operate the system. Passwords are stored only as secure hashes.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">How information is used</h2>
            <p className="mt-2">
              Information is used to provide role-based access, maintain farmer-to-product
              traceability, process marketplace orders, send password-reset codes, and secure the
              system. Buyer-facing pages identify PROCY as the seller; farmer ownership is visible
              only in the appropriate internal and Farmer workspaces.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Photos and external services</h2>
            <p className="mt-2">
              An optional profile-photo URL is displayed from the source selected by the account
              holder. Password-recovery emails are sent through the configured email provider. Do
              not place sensitive information in a public image URL or product image.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Access and corrections</h2>
            <p className="mt-2">
              Account holders may update their name, contact information, optional photo URL, and
              password from their profile. Contact Management to correct role assignments, resolve
              account access issues, or ask about saved information.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
