import { createFileRoute } from "@tanstack/react-router";
import { History, PiggyBank, WalletCards } from "lucide-react";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Button } from "@/components/ui/button";
import { FarmerLayout, FarmerPageHeader } from "@/components/workspaces/farmer-layout";
import {
  SettlementReceiptDialog,
  type SettlementReceipt,
} from "@/features/settlements/components/settlement-receipt-dialog";
import { settlementMoney } from "@/features/settlements/policy";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { getFarmerSettlementWorkspace } from "@/services/settlements/farmer-settlement-server-functions";

export const Route = createFileRoute("/farmer/earnings")({ component: FarmerEarnings });

function FarmerEarnings() {
  const request = useCallback(() => getFarmerSettlementWorkspace(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const [receipt, setReceipt] = useState<SettlementReceipt | null>(null);
  const releasedTotal = data?.payouts.reduce((sum, payout) => sum + payout.netAmount, 0) ?? 0;

  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="Earnings & IPON"
        description="Track your available crop earnings, accumulated IPON, and cash-release history."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="Farmer earnings"
        />
        {!loading && !error && data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <SummaryCard
                label="Available earnings"
                value={settlementMoney(data.availableTotal)}
                icon={WalletCards}
              />
              <SummaryCard
                label="Current IPON"
                value={settlementMoney(data.iponBalance)}
                icon={PiggyBank}
              />
              <SummaryCard
                label="Cash already received"
                value={settlementMoney(releasedTotal)}
                icon={History}
              />
            </section>

            <section className="mt-6 rounded-3xl border border-primary/20 bg-accent p-5 text-sm text-accent-foreground">
              <p className="opacity-85">
                Every sold kilogram has a fixed ₱1.75 deduction: ₱1.25 PROCY service fee and ₱0.50
                saved to IPON.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-semibold">Available for cash release</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Grouped by each product delivery you brought to PROCY.
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {data.available.length ? (
                  data.available.map((group) => (
                    <article
                      key={`${group.farmerId}-${group.receivingId}`}
                      className="rounded-3xl border border-border bg-card p-5 shadow-card"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Received {formatDate(group.receivedAt)}
                      </p>
                      <div className="mt-4 divide-y divide-border">
                        {group.lines.map((line) => (
                          <div key={line.id} className="py-3 text-sm">
                            <div className="flex justify-between gap-3">
                              <span className="font-medium">
                                {line.product} · {line.classification}
                              </span>
                              <span>
                                {line.quantity} {line.sellingUnit}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {line.orderNumber} · {settlementMoney(Number(line.pricePerUnit))} per{" "}
                              {line.sellingUnit}
                            </p>
                          </div>
                        ))}
                      </div>
                      <Breakdown
                        gross={group.grossAmount}
                        service={group.serviceFee}
                        ipon={group.iponContribution}
                        net={group.netAmount}
                      />
                    </article>
                  ))
                ) : (
                  <EmptyCard text="No earnings are waiting for cash release." />
                )}
              </div>
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-2">
              <HistoryCard title="Payout history" empty="No Farmer payout has been released yet.">
                {data.payouts.map((payout) => (
                  <HistoryRow
                    key={payout.id}
                    number={payout.payoutNumber}
                    date={payout.releasedAt}
                    amount={payout.netAmount}
                    onReceipt={() =>
                      setReceipt({
                        number: payout.payoutNumber,
                        farmerName: payout.farmerName,
                        releasedAt: payout.releasedAt,
                        amount: payout.netAmount,
                        kind: "earnings",
                        grossAmount: payout.grossAmount,
                        serviceFee: payout.serviceFee,
                        iponContribution: payout.iponContribution,
                      })
                    }
                  />
                ))}
              </HistoryCard>
              <HistoryCard
                title="IPON release history"
                empty="Your IPON has not been released yet."
              >
                {data.iponReleases.map((item) => (
                  <HistoryRow
                    key={item.id}
                    number={item.releaseNumber}
                    date={item.releasedAt}
                    amount={item.amount}
                    onReceipt={() =>
                      setReceipt({
                        number: item.releaseNumber,
                        farmerName: item.farmerName,
                        releasedAt: item.releasedAt,
                        amount: item.amount,
                        kind: "ipon",
                      })
                    }
                  />
                ))}
              </HistoryCard>
            </section>
          </>
        ) : null}
      </main>
      <SettlementReceiptDialog
        receipt={receipt}
        onOpenChange={(open) => !open && setReceipt(null)}
      />
    </FarmerLayout>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof WalletCards;
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-card">
      <Icon className="size-5 text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    </article>
  );
}
function Breakdown({
  gross,
  service,
  ipon,
  net,
}: {
  gross: number;
  service: number;
  ipon: number;
  net: number;
}) {
  return (
    <div className="mt-4 grid gap-2 rounded-2xl bg-muted/40 p-4 text-sm">
      <Row label="Gross share" value={settlementMoney(gross)} />
      <Row label="Service fee" value={`− ${settlementMoney(service)}`} />
      <Row label="Saved to IPON" value={`− ${settlementMoney(ipon)}`} />
      <div className="mt-1 border-t border-border pt-3">
        <Row label="Available cash" value={settlementMoney(net)} strong />
      </div>
    </div>
  );
}
function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold text-primary" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
function HistoryCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="border-b border-border p-5">
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-border">
        {Array.isArray(children) && children.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{empty}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
function HistoryRow({
  number,
  date,
  amount,
  onReceipt,
}: {
  number: string;
  date: Date | string;
  amount: number;
  onReceipt: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <p className="font-medium">{number}</p>
        <p className="text-sm text-muted-foreground">{formatDate(date)} · Cash</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold">{settlementMoney(amount)}</span>
        <Button variant="outline" className="rounded-full" onClick={onReceipt}>
          Receipt
        </Button>
      </div>
    </div>
  );
}
function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:col-span-2">
      {text}
    </div>
  );
}
function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(
    new Date(value),
  );
}
