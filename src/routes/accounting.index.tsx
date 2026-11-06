import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CircleAlert,
  CircleCheckBig,
  CircleDollarSign,
  Clock3,
  HandCoins,
  ReceiptText,
  RotateCcw,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { AccountingLayout, AccountingPageHeader } from "@/components/workspaces/accounting-layout";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getDailyCashClosingPreview } from "@/services/accounting/daily-closing-server-functions";
import { getAccountingDeliveryRefunds } from "@/services/marketplace/delivery-dispute-server-functions";
import { getDatabaseOrders } from "@/services/marketplace/marketplace-server-functions";
import { getAccountingFarmerSettlements } from "@/services/settlements/farmer-settlement-server-functions";

export const Route = createFileRoute("/accounting/")({ component: AccountingDashboard });

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const dateTime = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});
const dateKey = (value: Date | string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const todayKey = () => dateKey(new Date());
const daysAgoKey = (days: number) => dateKey(new Date(Date.now() - days * 86_400_000));

type Period = "today" | "7d" | "30d" | "all";

function isInPeriod(value: string | undefined, period: Period) {
  if (!value || period === "all") return period === "all" && Boolean(value);
  const key = dateKey(value);
  if (period === "today") return key === todayKey();
  return key >= daysAgoKey(period === "7d" ? 6 : 29);
}

function AccountingDashboard() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof getDatabaseOrders>>>([]);
  const [refunds, setRefunds] = useState<Awaited<ReturnType<typeof getAccountingDeliveryRefunds>>>(
    [],
  );
  const [settlements, setSettlements] = useState<Awaited<
    ReturnType<typeof getAccountingFarmerSettlements>
  > | null>(null);
  const [closing, setClosing] = useState<Awaited<
    ReturnType<typeof getDailyCashClosingPreview>
  > | null>(null);
  const [period, setPeriod] = useState<Period>("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const [nextOrders, nextRefunds, nextSettlements, nextClosing] = await Promise.all([
        getDatabaseOrders(),
        getAccountingDeliveryRefunds(),
        getAccountingFarmerSettlements(),
        getDailyCashClosingPreview({ data: { date: todayKey() } }),
      ]);
      setOrders(nextOrders);
      setRefunds(nextRefunds);
      setSettlements(nextSettlements);
      setClosing(nextClosing);
      setError(null);
    } catch (reason) {
      console.error("Unable to load Accounting dashboard.", reason);
      setError("Could not load the latest accounting workspace.");
      toast.error("Could not refresh the Accounting dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void loadDashboard(), [loadDashboard]);
  useAutoRefresh(loadDashboard);

  const dashboard = useMemo(() => {
    const paidInPeriod = orders.filter(
      (order) => order.paymentStatus === "Paid" && isInPeriod(order.paidAt, period),
    );
    const ordersInPeriod = orders.filter((order) => isInPeriod(order.createdAt, period));
    const paymentReady = orders.filter(
      (order) => order.status === "Sold" && order.paymentStatus === "Unpaid",
    );
    const outstandingAmount = paymentReady.reduce((sum, order) => sum + (order.amount ?? 0), 0);
    const pendingRefunds = refunds.filter((refund) => refund.refundStatus === "pending");
    const pendingRefundAmount = pendingRefunds.reduce(
      (sum, refund) => sum + (refund.refundAmount ?? 0),
      0,
    );
    const payoutAmount =
      settlements?.available.reduce((sum, payout) => sum + payout.netAmount, 0) ?? 0;
    const collected = paidInPeriod.reduce((sum, order) => sum + (order.amount ?? 0), 0);
    return {
      collected,
      ordersInPeriod,
      paidInPeriod,
      paymentReady,
      outstandingAmount,
      pendingRefunds,
      pendingRefundAmount,
      payoutAmount,
    };
  }, [orders, period, refunds, settlements]);

  const collectionTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const offset = 6 - index;
      const key = daysAgoKey(offset);
      const value = orders
        .filter(
          (order) =>
            order.paymentStatus === "Paid" && order.paidAt && dateKey(order.paidAt) === key,
        )
        .reduce((sum, order) => sum + (order.amount ?? 0), 0);
      return {
        key,
        label:
          offset === 0
            ? "Today"
            : new Date(`${key}T00:00:00+08:00`).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
              }),
        value,
      };
    });
    const maximum = Math.max(...days.map((day) => day.value), 1);
    return days.map((day) => ({
      ...day,
      width: `${Math.max((day.value / maximum) * 100, day.value ? 5 : 0)}%`,
    }));
  }, [orders]);

  const recentActivity = useMemo(
    () =>
      [...orders]
        .sort((left, right) => {
          const leftDate = left.paidAt ?? left.soldAt ?? left.createdAt ?? "";
          const rightDate = right.paidAt ?? right.soldAt ?? right.createdAt ?? "";
          return new Date(rightDate).getTime() - new Date(leftDate).getTime();
        })
        .slice(0, 6),
    [orders],
  );

  const periodLabel =
    period === "today"
      ? "today"
      : period === "7d"
        ? "in the last 7 days"
        : period === "30d"
          ? "in the last 30 days"
          : "across all saved records";

  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Accounting Dashboard"
        description="Review collections, pending work, farmer payouts, and today's cash closing from one workspace."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-card lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold">Today’s accounting workspace</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Prioritize pending financial work, then reconcile and close the business day.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <AppSelect
              ariaLabel="Dashboard reporting period"
              value={period}
              onValueChange={(value) => setPeriod(value as Period)}
              className="sm:w-44"
              options={[
                { value: "today", label: "Today" },
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "all", label: "All records" },
              ]}
            />
            <Button asChild>
              <Link to="/accounting/payments">
                <CircleDollarSign className="size-4" /> Record payment
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/accounting/daily-closing">
                <CalendarDays className="size-4" /> Daily closing
              </Link>
            </Button>
          </div>
        </section>

        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void loadDashboard()}
          label="accounting dashboard"
        />

        {!loading && !error ? (
          <>
            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={ReceiptText}
                label="Orders recorded"
                value={String(dashboard.ordersInPeriod.length)}
                note={`Created ${periodLabel}`}
                to="/accounting/transactions"
              />
              <MetricCard
                icon={CircleCheckBig}
                label="Paid orders"
                value={String(dashboard.paidInPeriod.length)}
                note={`Payments recorded ${periodLabel}`}
                to="/accounting/transactions"
              />
              <MetricCard
                icon={WalletCards}
                label="Amount collected"
                value={currency.format(dashboard.collected)}
                note={`Paid order total ${periodLabel}`}
                to="/accounting/transactions"
              />
              <MetricCard
                icon={Clock3}
                label="Outstanding orders"
                value={currency.format(dashboard.outstandingAmount)}
                note={`${dashboard.paymentReady.length} sold order${dashboard.paymentReady.length === 1 ? "" : "s"} awaiting payment`}
                to="/accounting/payments"
                attention={dashboard.paymentReady.length > 0}
              />
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                <div className="flex items-start justify-between gap-4 border-b border-border p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <CircleAlert className="size-5 text-primary" />
                      <h2 className="text-lg font-semibold">Needs attention</h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Live queues that require an Accounting action.
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {dashboard.paymentReady.length +
                      dashboard.pendingRefunds.length +
                      (settlements?.available.length ?? 0)}{" "}
                    pending
                  </span>
                </div>
                <div className="divide-y divide-border">
                  <AttentionRow
                    icon={CircleDollarSign}
                    title="Record buyer payments"
                    detail={`${dashboard.paymentReady.length} sold order${dashboard.paymentReady.length === 1 ? " is" : "s are"} ready · ${currency.format(dashboard.outstandingAmount)}`}
                    to="/accounting/payments"
                    urgent={dashboard.paymentReady.length > 0}
                  />
                  <AttentionRow
                    icon={RotateCcw}
                    title="Process delivery refunds"
                    detail={`${dashboard.pendingRefunds.length} approved refund${dashboard.pendingRefunds.length === 1 ? "" : "s"} · ${currency.format(dashboard.pendingRefundAmount)}`}
                    to="/accounting/refunds"
                    urgent={dashboard.pendingRefunds.length > 0}
                  />
                  <AttentionRow
                    icon={HandCoins}
                    title="Release farmer payouts"
                    detail={`${settlements?.available.length ?? 0} payout batch${settlements?.available.length === 1 ? "" : "es"} · ${currency.format(dashboard.payoutAmount)}`}
                    to="/accounting/farmer-payouts"
                    urgent={Boolean(settlements?.available.length)}
                  />
                </div>
              </article>

              <article className="rounded-3xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Banknote className="size-5 text-primary" />
                      <h2 className="text-lg font-semibold">Today’s cash closing</h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{todayKey()} business date</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${closing?.existing ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
                  >
                    {closing?.existing ? "Closed" : "Open"}
                  </span>
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Expected cash</dt>
                    <dd className="mt-1 text-lg font-semibold">
                      {currency.format(
                        closing?.existing?.adjustedExpectedCash ??
                          closing?.preview?.expectedCash ??
                          0,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Pending COD</dt>
                    <dd className="mt-1 text-lg font-semibold">
                      {currency.format(
                        closing?.existing?.pendingCod ?? closing?.preview?.pendingCod ?? 0,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Actual cash</dt>
                    <dd className="mt-1 text-lg font-semibold">
                      {closing?.existing
                        ? currency.format(closing.existing.actualCash)
                        : "Not counted"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Variance</dt>
                    <dd className="mt-1 text-lg font-semibold">
                      {closing?.existing
                        ? currency.format(closing.existing.adjustedVariance)
                        : "Pending"}
                    </dd>
                  </div>
                </dl>
                <Button
                  asChild
                  className="mt-6 w-full"
                  variant={closing?.existing ? "outline" : "default"}
                >
                  <Link to="/accounting/daily-closing">
                    {closing?.existing ? "Review closing record" : "Reconcile and close day"}
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </article>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <article className="rounded-3xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">Seven-day collections</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paid order totals by payment date.
                </p>
                <div className="mt-5 space-y-3">
                  {collectionTrend.map((day) => (
                    <div
                      key={day.key}
                      className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-xs"
                    >
                      <span className="text-muted-foreground">{day.label}</span>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: day.width }}
                        />
                      </div>
                      <span className="min-w-20 text-right font-semibold">
                        {currency.format(day.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                <div className="flex items-center justify-between gap-3 border-b border-border p-5">
                  <div>
                    <h2 className="text-lg font-semibold">Recent order activity</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Latest saved payment and sales states.
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/accounting/transactions">
                      View all <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                </div>
                {recentActivity.length ? (
                  <div className="divide-y divide-border">
                    {recentActivity.map((order) => {
                      const activityDate = order.paidAt ?? order.soldAt ?? order.createdAt;
                      return (
                        <div
                          key={order.id}
                          className="flex items-center justify-between gap-4 px-5 py-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {order.id} · {order.buyer}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {order.paymentStatus === "Paid"
                                ? "Payment recorded"
                                : `${order.status} · payment pending`}
                              {activityDate ? ` · ${dateTime.format(new Date(activityDate))}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold">{order.total}</p>
                            <span
                              className={`text-xs font-medium ${order.paymentStatus === "Paid" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}
                            >
                              {order.paymentStatus}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    No order activity yet.
                  </p>
                )}
              </article>
            </section>
          </>
        ) : null}
      </main>
    </AccountingLayout>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  to,
  attention = false,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: string;
  note: string;
  to: "/accounting/transactions" | "/accounting/payments";
  attention?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <span
              className={`flex size-9 items-center justify-center rounded-2xl ${attention ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}`}
            >
              <Icon className="size-5" />
            </span>
            <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function AttentionRow({
  icon: Icon,
  title,
  detail,
  to,
  urgent,
}: {
  icon: typeof CircleDollarSign;
  title: string;
  detail: string;
  to: "/accounting/payments" | "/accounting/refunds" | "/accounting/farmer-payouts";
  urgent: boolean;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 p-5 transition-colors hover:bg-accent/50"
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${urgent ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}
