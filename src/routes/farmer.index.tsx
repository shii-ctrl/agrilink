import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageCheck, PiggyBank, WalletCards } from "lucide-react";
import { useCallback, useMemo } from "react";
import { FarmerLayout, FarmerPageHeader } from "@/components/workspaces/farmer-layout";
import { Button } from "@/components/ui/button";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { getFarmerProductStatuses } from "@/services/operations/receiving-server-functions";
import { getFarmerSettlementWorkspace } from "@/services/settlements/farmer-settlement-server-functions";
import { settlementMoney } from "@/features/settlements/policy";
export const Route = createFileRoute("/farmer/")({ component: FarmerDashboard });
const emptyStatuses: Awaited<ReturnType<typeof getFarmerProductStatuses>> = [];
function FarmerDashboard() {
  const request = useCallback(async () => {
    const [statuses, settlement] = await Promise.all([
      getFarmerProductStatuses(),
      getFarmerSettlementWorkspace(),
    ]);
    return { statuses, settlement };
  }, []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const statuses = data?.statuses ?? emptyStatuses;
  const availableKg = useMemo(
    () => statuses.reduce((sum, item) => sum + item.availableKg, 0),
    [statuses],
  );
  const listedCount = statuses.filter((item) => item.status.startsWith("Listed")).length;
  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="Farmer Dashboard"
        description="View receiving information and current product availability as a PROCY farmer member."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="farmer dashboard"
        />
        {!loading && !error && (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <Tile
                icon={PackageCheck}
                title="Receiving History"
                text={`${availableKg} kg of your classified product stock is currently available.`}
                to="/farmer/receiving"
              />
              <Tile
                icon={WalletCards}
                title="Available earnings"
                text={`${settlementMoney(data?.settlement.availableTotal ?? 0)} remains available until Accounting gives you the cash.`}
                to="/farmer/earnings"
              />
              <Tile
                icon={PiggyBank}
                title="IPON"
                text={`${settlementMoney(data?.settlement.iponBalance ?? 0)} is currently saved for your December release.`}
                to="/farmer/earnings"
              />
            </section>
            <section className="mt-6 rounded-3xl border border-primary/20 bg-accent p-6 text-sm text-accent-foreground">
              <span className="font-semibold">Your role:</span> farmers supply products to PROCY.
              PROCY handles classification, marketplace listings, buyer orders, and sales.
            </section>
            <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-6 py-5">
                <h2 className="text-lg font-semibold">Sales and payment status</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your receiving page shows the marketplace status of each product you supplied.
                  Buyer contact details are intentionally never shared in this view.
                </p>
              </div>
              <p className="px-6 py-8 text-sm text-muted-foreground">
                {statuses.length
                  ? `${listedCount} of your classified product record${listedCount === 1 ? " is" : "s are"} listed for buyers. Open Receiving History for the full status table.`
                  : "No classified product record has been saved for your account yet."}
              </p>
            </section>
          </>
        )}
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
  icon: typeof PackageCheck;
  title: string;
  text: string;
  to: "/farmer/receiving" | "/farmer/earnings";
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
