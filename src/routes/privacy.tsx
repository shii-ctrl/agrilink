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
        <p className="mt-4 text-muted-foreground">Last updated: November 5, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">Information we save</h2>
            <p className="mt-2">
              AgriLink saves account details, marketplace activity, orders, payments, delivery
              information, notifications, and security logs needed to provide the service. Passwords
              are protected and are not stored as readable text.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">How information is used</h2>
            <p className="mt-2">
              Information is used to manage accounts, process orders, arrange pickup or delivery,
              provide support, send account-recovery messages, and protect AgriLink from misuse.
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
              You may update your account details, profile photo, and password from your profile.
              Contact PROCY for account access help or questions about your saved information.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
