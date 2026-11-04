import { createFileRoute } from "@tanstack/react-router";
import { Banknote, CheckCircle2, LoaderCircle, PiggyBank } from "lucide-react";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "@/lib/ui/toast";

import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Button } from "@/components/ui/button";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { AccountingLayout, AccountingPageHeader } from "@/components/workspaces/accounting-layout";
import {
  SettlementReceiptDialog,
  type SettlementReceipt,
} from "@/features/settlements/components/settlement-receipt-dialog";
import { settlementMoney } from "@/features/settlements/policy";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  getAccountingFarmerSettlements,
  releaseFarmerCashPayout,
  releaseFarmerIpon,
} from "@/services/settlements/farmer-settlement-server-functions";

export const Route = createFileRoute("/accounting/farmer-payouts")({
  component: AccountingFarmerPayouts,
});

function AccountingFarmerPayouts() {
  const request = useCallback(() => getAccountingFarmerSettlements(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const [processing, setProcessing] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SettlementReceipt | null>(null);
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const availableTotal = data?.available.reduce((sum, group) => sum + group.netAmount, 0) ?? 0;
  const iponTotal = data?.iponBalances.reduce((sum, item) => sum + item.balance, 0) ?? 0;

  async function releasePayout(group: NonNullable<typeof data>["available"][number]) {
    const confirmed = await requestConfirmation({
      title: "Confirm Farmer cash release",
      description: `Confirm that ${settlementMoney(group.netAmount)} cash was physically given to ${group.farmerName}. This moves the amount to payout history.`,
      confirmLabel: "Confirm cash released",
      cancelLabel: "Not yet",
    });
    if (!confirmed) return;
    const key = `payout:${group.farmerId}:${group.receivingId}`;
    setProcessing(key);
    try {
      const result = await releaseFarmerCashPayout({
        data: { farmerId: group.farmerId, receivingId: group.receivingId },
      });
      await reload();
      setReceipt({
        number: result.payoutNumber,
        farmerName: result.farmerName,
        releasedAt: new Date(),
        amount: result.netAmount,
        kind: "earnings",
        grossAmount: result.grossAmount,
        serviceFee: result.serviceFee,
        iponContribution: result.iponContribution,
      });
      toast.success("Farmer cash payout released", {
        description: `${result.payoutNumber} was moved to payout history.`,
      });
    } catch (cause) {
      toast.error("Could not release payout", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setProcessing(null);
    }
  }

  async function releaseIpon(item: NonNullable<typeof data>["iponBalances"][number]) {
    const confirmed = await requestConfirmation({
      title: "Confirm full IPON release",
      description: `Confirm that the full ${settlementMoney(item.balance)} IPON balance was physically given to ${item.farmerName} in cash.`,
      confirmLabel: "Release full IPON",
      cancelLabel: "Not yet",
    });
    if (!confirmed) return;
    const key = `ipon:${item.farmerId}`;
    setProcessing(key);
    try {
      const result = await releaseFarmerIpon({ data: { farmerId: item.farmerId } });
      await reload();
      setReceipt({
        number: result.releaseNumber,
        farmerName: result.farmerName,
        releasedAt: new Date(),
        amount: result.amount,
        kind: "ipon",
      });
      toast.success("IPON released", {
        description: `${result.releaseNumber} was moved to IPON history.`,
      });
    } catch (cause) {
      toast.error("Could not release IPON", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setProcessing(null);
    }
  }

  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Farmer Payouts & IPON"
        description="Release Farmer earnings in cash and manage the annual December IPON release."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="Farmer payouts"
        />
        {!loading && !error && data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <Metric
                label="Available Farmer earnings"
                value={settlementMoney(availableTotal)}
                icon={Banknote}
              />
              <Metric
                label="Outstanding IPON"
                value={settlementMoney(iponTotal)}
                icon={PiggyBank}
              />
              <Metric
                label="Payout receipts"
                value={String(data.payouts.length)}
                icon={CheckCircle2}
              />
            </section>
            <section className="mt-6 rounded-3xl border border-primary/20 bg-accent p-5 text-sm text-accent-foreground">
              <p className="font-semibold">Accounting is the only release authority.</p>
              <p className="mt-1 opacity-85">
                Confirm only after cash is physically given to the Farmer. The amount will
                immediately leave the Farmer's available balance and appear in both histories with a
                receipt.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-semibold">Cash payout queue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each payout is grouped by one Farmer delivery to PROCY.
              </p>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {data.available.length ? (
                  data.available.map((group) => {
                    const key = `payout:${group.farmerId}:${group.receivingId}`;
                    return (
                      <article
                        key={key}
                        className="rounded-3xl border border-border bg-card p-5 shadow-card"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{group.farmerName}</p>
                            <p className="text-sm text-muted-foreground">
                              Delivery received {formatDate(group.receivedAt)}
                            </p>
                          </div>
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                            {group.lines.length} sale line{group.lines.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="mt-4 divide-y divide-border rounded-2xl border border-border px-4">
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
                                {line.orderNumber}
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
                        <Button
                          className="mt-4 w-full rounded-full"
                          disabled={processing !== null}
                          onClick={() => void releasePayout(group)}
                        >
                          {processing === key ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-4" />
                          )}
                          Confirm cash released
                        </Button>
                      </article>
                    );
                  })
                ) : (
                  <Empty text="No Farmer earnings are waiting for cash release." />
                )}
              </div>
            </section>

            <section className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="border-b border-border p-5">
                <h2 className="font-semibold">IPON balances</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  IPON is released in full during December only. It is separate from regular Farmer
                  earnings.
                </p>
              </div>
              {data.iponBalances.length ? (
                <div className="divide-y divide-border">
                  {data.iponBalances.map((item) => {
                    const key = `ipon:${item.farmerId}`;
                    return (
                      <div
                        key={item.farmerId}
                        className="flex flex-wrap items-center justify-between gap-4 p-5"
                      >
                        <div>
                          <p className="font-medium">{item.farmerName}</p>
                          <p className="text-sm text-muted-foreground">Accumulated IPON</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-display text-2xl font-semibold">
                            {settlementMoney(item.balance)}
                          </span>
                          <Button
                            variant={data.isDecember ? "default" : "outline"}
                            className="rounded-full"
                            disabled={!data.isDecember || processing !== null}
                            onClick={() => void releaseIpon(item)}
                          >
                            {processing === key ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : null}
                            {data.isDecember ? "Release full IPON" : "Available every December"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="p-6 text-sm text-muted-foreground">No outstanding IPON balance.</p>
              )}
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-2">
              <History title="Farmer payout history" empty="No cash payout receipt yet">
                {data.payouts.map((payout) => (
                  <HistoryItem
                    key={payout.id}
                    number={payout.payoutNumber}
                    name={payout.farmerName}
                    date={payout.releasedAt}
                    amount={payout.netAmount}
                    onClick={() =>
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
              </History>
              <History title="IPON release history" empty="No IPON release receipt yet">
                {data.iponReleases.map((item) => (
                  <HistoryItem
                    key={item.id}
                    number={item.releaseNumber}
                    name={item.farmerName}
                    date={item.releasedAt}
                    amount={item.amount}
                    onClick={() =>
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
              </History>
            </section>
          </>
        ) : null}
      </main>
      <SettlementReceiptDialog
        receipt={receipt}
        onOpenChange={(open) => !open && setReceipt(null)}
      />
      {confirmationDialog}
    </AccountingLayout>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Banknote;
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
      <Line label="Gross share" value={settlementMoney(gross)} />
      <Line label="Service fee" value={`− ${settlementMoney(service)}`} />
      <Line label="Saved to IPON" value={`− ${settlementMoney(ipon)}`} />
      <div className="mt-1 border-t border-border pt-3">
        <Line label="Cash to release" value={settlementMoney(net)} strong />
      </div>
    </div>
  );
}
function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold text-primary" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground xl:col-span-2">
      {text}
    </p>
  );
}
function History({
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
function HistoryItem({
  number,
  name,
  date,
  amount,
  onClick,
}: {
  number: string;
  name: string;
  date: Date | string;
  amount: number;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <p className="font-medium">{number}</p>
        <p className="text-sm text-muted-foreground">
          {name} · {formatDate(date)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold">{settlementMoney(amount)}</span>
        <Button variant="outline" className="rounded-full" onClick={onClick}>
          Receipt
        </Button>
      </div>
    </div>
  );
}
function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(
    new Date(value),
  );
}
