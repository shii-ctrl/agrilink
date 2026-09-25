import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, MessageCircle, PackageCheck } from "lucide-react";
import { FarmerLayout, FarmerPageHeader } from "@/components/farmer-layout";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/farmer/")({ component: FarmerDashboard });
function FarmerDashboard() {
  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="Farmer Dashboard"
        description="View your personal production, receiving, and crop-guidance information as a PROCY farmer member."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <section className="grid gap-4 md:grid-cols-3">
          <Tile
            icon={ClipboardList}
            title="Production Records"
            text="2 temporary records for your crops and harvest plans."
            to="/farmer/production"
          />
          <Tile
            icon={PackageCheck}
            title="Receiving History"
            text="220 kg of delivered produce recorded by PROCY."
            to="/farmer/receiving"
          />
          <Tile
            icon={MessageCircle}
            title="Crop Guidance"
            text="Read and reply to your Farm Consultant guidance."
            to="/farmer/guidance"
          />
        </section>
        <section className="mt-6 rounded-3xl border border-primary/20 bg-accent p-6 text-sm text-accent-foreground">
          <span className="font-semibold">Your role:</span> farmers supply products to PROCY. PROCY
          handles classification, marketplace listings, buyer orders, and sales.
        </section>
        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold">Sales and payment status</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sales will appear here once each classified inventory record is linked to its source
              farmer. Buyer contact details are intentionally never shared in this view.
            </p>
          </div>
          <p className="px-6 py-8 text-sm text-muted-foreground">No connected sales yet.</p>
        </section>
      </main>
    </FarmerLayout>
  );
}
function Tile({
  icon: Icon,
  title,
  text,
  to,
}: {
  icon: typeof ClipboardList;
  title: string;
  text: string;
  to: "/farmer/production" | "/farmer/receiving" | "/farmer/guidance";
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <Icon className="size-5 text-primary" />
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-2 min-h-12 text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="outline" className="mt-5 rounded-full">
        <Link to={to}>Open</Link>
      </Button>
    </article>
  );
}
