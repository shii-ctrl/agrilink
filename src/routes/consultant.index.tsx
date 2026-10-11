import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConsultantLayout, ConsultantPageHeader } from "@/components/workspaces/consultant-layout";
import { Button } from "@/components/ui/button";
import { getConsultantProductionRecords } from "@/services/operations/production-server-functions";
export const Route = createFileRoute("/consultant/")({ component: ConsultantDashboard });
function ConsultantDashboard() {
  const [production, setProduction] = useState<
    Awaited<ReturnType<typeof getConsultantProductionRecords>>
  >([]);
  useEffect(() => {
    void getConsultantProductionRecords()
      .then(setProduction)
      .catch(() => toast.error("Could not load saved farmer records."));
  }, []);
  const farmers = new Set(production.map((record) => record.farmerId)).size;
  return (
    <ConsultantLayout>
      <ConsultantPageHeader
        title="Consultant Dashboard"
        description="Review farmer production information and provide focused crop guidance to farmer members."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <section className="grid gap-4 md:grid-cols-3">
          <Card
            icon={ClipboardList}
            title="Farmer Members"
            value={String(farmers)}
            note="Farmer accounts with saved production records"
            to="/consultant/production"
          />
          <Card
            icon={ClipboardList}
            title="Production Records"
            value={String(production.length)}
            note="Available for guidance context"
            to="/consultant/production"
          />
          <Card
            icon={MessageCircle}
            title="Guidance Conversations"
            value="Saved"
            note="Open guidance to view and send saved messages"
            to="/consultant/guidance"
          />
        </section>
        <section className="mt-6 rounded-3xl border border-primary/20 bg-accent p-6 text-sm text-accent-foreground">
          <span className="font-semibold">Consultant scope:</span> provide crop guidance and
          relevant production support. Marketplace listings, buyer orders, sales, and payments are
          outside this role.
        </section>
      </main>
    </ConsultantLayout>
  );
}
function Card({
  icon: Icon,
  title,
  value,
  note,
  to,
}: {
  icon: typeof ClipboardList;
  title: string;
  value: string;
  note: string;
  to: "/consultant/production" | "/consultant/guidance";
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <Icon className="size-5 text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 min-h-10 text-xs text-muted-foreground">{note}</p>
      <Button asChild variant="outline" className="mt-5 rounded-full">
        <Link to={to}>Open</Link>
      </Button>
    </article>
  );
}
