import { createFileRoute } from "@tanstack/react-router";
import {
  Banknote,
  CircleAlert,
  Download,
  Landmark,
  LockKeyhole,
  PhilippinePeso,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  Scale,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { AccountingLayout, AccountingPageHeader } from "@/components/workspaces/accounting-layout";
import { EmptyState } from "@/components/data/empty-state";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Button } from "@/components/ui/button";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addDailyCashAdjustment,
  closeDailyCash,
  getDailyCashClosingHistory,
  getDailyCashClosingPreview,
} from "@/services/accounting/daily-closing-server-functions";

export const Route = createFileRoute("/accounting/daily-closing")({
  component: DailyClosingPage,
});

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const todayInManila = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function DailyClosingPage() {
  const [date, setDate] = useState(todayInManila);
  const [data, setData] = useState<Awaited<ReturnType<typeof getDailyCashClosingPreview>> | null>(
    null,
  );
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getDailyCashClosingHistory>>>(
    [],
  );
  const [openingCash, setOpeningCash] = useState(0);
  const [actualCash, setActualCash] = useState(0);
  const [notes, setNotes] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const { requestConfirmation, confirmationDialog } = useConfirmAction();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [preview, records] = await Promise.all([
        getDailyCashClosingPreview({ data: { date } }),
        getDailyCashClosingHistory(),
      ]);
      setData(preview);
      setHistory(records);
      if (preview.existing) {
        setOpeningCash(preview.existing.openingCash);
        setActualCash(preview.existing.actualCash);
        setNotes(preview.existing.notes ?? "");
      } else {
        setOpeningCash(preview.suggestedOpeningCash);
        setActualCash(preview.preview?.expectedCash ?? 0);
        setNotes("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the daily closing.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => void load(), [load]);
  const liveExpected = useMemo(() => {
    if (data?.existing) return data.existing.adjustedExpectedCash;
    if (!data?.preview) return 0;
    return data.preview.expectedCash - data.preview.openingCash + openingCash;
  }, [data, openingCash]);
  const variance = Number(actualCash || 0) - liveExpected;
  const existingClosing = data?.existing ?? null;
  const totals = data?.existing ?? data?.preview;

  async function closeDay() {
    const confirmed = await requestConfirmation({
      title: `Close ${date}?`,
      description:
        "Accounting confirms that the physical cash was counted. The closing record will be locked; later corrections require a separate audited adjustment.",
      confirmLabel: "Close and lock day",
      cancelLabel: "Review again",
      holdToConfirmMs: 2000,
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await closeDailyCash({ data: { date, openingCash, actualCash, notes } });
      toast.success("Daily cash closing saved and locked.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not close the day.");
    } finally {
      setBusy(false);
    }
  }

  async function addAdjustment() {
    if (!data?.existing) return;
    setBusy(true);
    try {
      await addDailyCashAdjustment({
        data: {
          closingId: data.existing.id,
          amount: Number(adjustmentAmount),
          reason: adjustmentReason,
        },
      });
      toast.success("Audited adjustment added.");
      setAdjustmentAmount("");
      setAdjustmentReason("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the adjustment.");
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    const rows = [
      ["Business date", date],
      ["Opening cash", openingCash],
      ["Gross sales", totals?.grossSales ?? 0],
      ["Pickup collections", totals?.pickupCollections ?? 0],
      ["COD collections", totals?.codCollections ?? 0],
      ["Pending COD", totals?.pendingCod ?? 0],
      ["Refunds", totals?.refunds ?? 0],
      ["Farmer payouts", totals?.farmerPayouts ?? 0],
      ["IPON releases", totals?.iponReleases ?? 0],
      ["Expected cash", liveExpected],
      ["Actual cash", actualCash],
      ["Variance", variance],
    ];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" }),
    );
    link.download = `agrilink-daily-closing-${date}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Daily Cash Closing"
        description="Reconcile PROCY cash, explain any variance, and lock one verified record per business day."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-card sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-xs">
            <label htmlFor="closing-date" className="text-sm font-medium">
              Business date
            </label>
            <Input
              id="closing-date"
              type="date"
              max={todayInManila()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading || busy}>
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" onClick={downloadCsv} disabled={!totals}>
              <Download className="size-4" /> Download CSV
            </Button>
          </div>
        </section>

        {loading ? (
          <div className="mt-5">
            <WorkspaceLoadState
              loading
              error={null}
              onRetry={() => void load()}
              label="daily cash totals"
            />
          </div>
        ) : null}
        {!loading && totals ? (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                icon={ReceiptText}
                label="Gross sales"
                value={totals.grossSales}
                note="Pickup and paid COD combined"
              />
              <Metric
                icon={WalletCards}
                label="Pickup collections"
                value={totals.pickupCollections}
                note="Cash received at PROCY"
              />
              <Metric
                icon={Banknote}
                label="COD collections"
                value={totals.codCollections}
                note="Recorded cash-on-delivery payments"
              />
              <Metric
                icon={CircleAlert}
                label="COD not yet remitted"
                value={totals.pendingCod}
                note="Collected or submitted by Riders"
                warning={totals.pendingCod > 0}
              />
              <Metric
                icon={Landmark}
                label="Farmer payouts"
                value={totals.farmerPayouts}
                note="Cash released today"
              />
              <Metric
                icon={PhilippinePeso}
                label="PROCY service fee"
                value={totals.serviceFeeIncome}
                note="Income earned from eligible sales"
              />
              <Metric
                icon={PiggyBank}
                label="IPON contributions"
                value={totals.iponContributions}
                note="Farmer liability, not PROCY income"
              />
              <Metric
                icon={Scale}
                label="Refunds"
                value={totals.refunds}
                note={`Delivery fees ${currency.format(totals.deliveryFees)} · Farmer payable ${currency.format(totals.farmerPayable)}`}
              />
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <article className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                      <LockKeyhole className="size-5 text-primary" /> Cash count
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Delivery fees are already included in sales and are never counted twice.
                    </p>
                  </div>
                  {existingClosing ? (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      Closed and locked
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <MoneyInput
                    label="Opening cash"
                    value={openingCash}
                    onChange={setOpeningCash}
                    disabled={Boolean(existingClosing)}
                  />
                  <MoneyInput
                    label="Actual closing cash"
                    value={actualCash}
                    onChange={setActualCash}
                    disabled={Boolean(existingClosing)}
                  />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <CashTotal label="Expected cash" value={liveExpected} />
                  <CashTotal label="Actual cash" value={actualCash} />
                  <CashTotal
                    label={variance > 0 ? "Overage" : variance < 0 ? "Shortage" : "Balanced"}
                    value={variance}
                    emphasized
                  />
                </div>
                <label htmlFor="closing-notes" className="mt-5 block text-sm font-medium">
                  Variance note {Math.abs(variance) >= 0.01 ? "(required)" : "(optional)"}
                </label>
                <Textarea
                  id="closing-notes"
                  value={notes}
                  disabled={Boolean(existingClosing)}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Explain any shortage, overage, or unusual transaction…"
                  className="mt-2 min-h-24 rounded-2xl"
                />
                {!existingClosing ? (
                  <Button
                    className="mt-5 w-full sm:w-auto"
                    onClick={() => void closeDay()}
                    disabled={busy}
                  >
                    <LockKeyhole className="size-4" /> {busy ? "Closing…" : "Close and lock day"}
                  </Button>
                ) : null}
              </article>

              <article className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
                <h2 className="text-lg font-semibold">Audited corrections</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A closed day stays unchanged. Add a signed correction with a reason instead.
                </p>
                {existingClosing ? (
                  <>
                    <MoneyInput
                      label="Adjustment (+ / −)"
                      value={adjustmentAmount}
                      onChange={(value) => setAdjustmentAmount(String(value))}
                    />
                    <label htmlFor="adjustment-reason" className="mt-4 block text-sm font-medium">
                      Reason
                    </label>
                    <Textarea
                      id="adjustment-reason"
                      value={adjustmentReason}
                      onChange={(event) => setAdjustmentReason(event.target.value)}
                      className="mt-2 rounded-2xl"
                      placeholder="Why is this correction needed?"
                    />
                    <Button
                      variant="outline"
                      className="mt-4 w-full"
                      onClick={() => void addAdjustment()}
                      disabled={busy || !adjustmentAmount || adjustmentReason.trim().length < 5}
                    >
                      Add audited adjustment
                    </Button>
                    <div className="mt-5 space-y-2">
                      {existingClosing.adjustments.map((item) => (
                        <div key={item.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                          <div className="flex justify-between gap-3">
                            <span>{item.reason}</span>
                            <strong>{currency.format(item.amount)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-5 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                    Corrections become available only after the day is closed.
                  </p>
                )}
              </article>
            </section>

            <section className="mt-5 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Closing history</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Permanent daily records visible to Accounting and Management.
                </p>
              </div>
              {history.length ? (
                <>
                  <div className="grid gap-3 px-4 pb-4 md:hidden">
                    {history.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-border bg-background p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{item.businessDate}</p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.adjustedVariance === 0 ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-800"}`}
                          >
                            {item.adjustedVariance === 0
                              ? "Balanced"
                              : item.adjustedVariance > 0
                                ? "Overage"
                                : "Shortage"}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <CashHistoryValue label="Sales" value={item.grossSales} />
                          <CashHistoryValue label="Expected" value={item.adjustedExpectedCash} />
                          <CashHistoryValue label="Actual" value={item.actualCash} />
                          <CashHistoryValue label="Variance" value={item.adjustedVariance} />
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Closed by {item.closedByName}
                        </p>
                      </article>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Sales</th>
                          <th className="px-5 py-3">Expected</th>
                          <th className="px-5 py-3">Actual</th>
                          <th className="px-5 py-3">Variance</th>
                          <th className="px-5 py-3">Closed by</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {history.map((item) => (
                          <tr key={item.id}>
                            <td className="px-5 py-4 font-medium">{item.businessDate}</td>
                            <td className="px-5 py-4">{currency.format(item.grossSales)}</td>
                            <td className="px-5 py-4">
                              {currency.format(item.adjustedExpectedCash)}
                            </td>
                            <td className="px-5 py-4">{currency.format(item.actualCash)}</td>
                            <td
                              className={`px-5 py-4 font-semibold ${item.adjustedVariance === 0 ? "text-primary" : "text-amber-700"}`}
                            >
                              {currency.format(item.adjustedVariance)}
                            </td>
                            <td className="px-5 py-4 text-muted-foreground">{item.closedByName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={LockKeyhole}
                  title="No closing history yet"
                  description="The first verified daily closing will appear here permanently."
                />
              )}
            </section>
          </>
        ) : null}
      </main>
      {confirmationDialog}
    </AccountingLayout>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
  warning = false,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: number;
  note: string;
  warning?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border bg-card p-5 shadow-card ${warning ? "border-amber-300" : "border-border"}`}
    >
      <Icon className={`size-5 ${warning ? "text-amber-600" : "text-primary"}`} />
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{currency.format(value)}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>
    </article>
  );
}
function MoneyInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number | string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <span className="relative mt-2 block">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
        <Input
          type="number"
          step="0.01"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-11 rounded-xl pl-8"
        />
      </span>
    </label>
  );
}
function CashTotal({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${emphasized ? "bg-primary text-primary-foreground" : "bg-muted/40"}`}
    >
      <p className="text-xs opacity-75">{label}</p>
      <p className="mt-1 text-xl font-semibold">{currency.format(value)}</p>
    </div>
  );
}
function CashHistoryValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{currency.format(value)}</p>
    </div>
  );
}
