import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Database, PackageOpen, PieChart as PieChartIcon, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AppSelect } from "@/components/ui/app-select";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { toast } from "sonner";
import {
  getManagementDashboard,
  getManagementDeliveryOperations,
  getManagementDeliveryFee,
  assignDeliveryRider,
  updateManagementDeliveryAvailability,
  updateManagementDeliveryFee,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/management/")({
  head: () => ({
    meta: [
      { title: "Management Dashboard — AgriLink" },
      {
        name: "description",
        content: "Management overview for AgriLink operational records.",
      },
    ],
  }),
  component: ManagementDashboard,
});

function manilaDateValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value["year"]}-${value["month"]}-${value["day"]}`;
}

function relativeTime(value: string) {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.round(elapsedHours / 24)}d ago`;
}

function activityStyle(kind: string) {
  if (kind === "sale") return { icon: TrendingUp, color: "bg-sky-500/15 text-sky-600" };
  if (kind === "payment") return { icon: Database, color: "bg-violet-500/15 text-violet-600" };
  if (kind === "order") return { icon: Clock3, color: "bg-amber-500/15 text-amber-700" };
  return { icon: PackageOpen, color: "bg-primary/15 text-primary" };
}

function ManagementDashboard() {
  const today = manilaDateValue();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedYear, setSelectedYear] = useState(Number(today.slice(0, 4)));
  const [range, setRange] = useState<"day" | "month" | "all">("day");
  const [deliveryFee, setDeliveryFee] = useState("59");
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [savingDeliveryFee, setSavingDeliveryFee] = useState(false);
  const [savingDeliveryAvailability, setSavingDeliveryAvailability] = useState(false);
  const [deliveryOperations, setDeliveryOperations] = useState<
    Awaited<ReturnType<typeof getManagementDeliveryOperations>> | undefined
  >();
  const [assigningOrder, setAssigningOrder] = useState<string | null>(null);
  const isMonthly = range === "month";
  const isAllTime = range === "all";
  const request = useCallback(
    () =>
      getManagementDashboard({
        data:
          range === "all"
            ? { range: "all", year: selectedYear }
            : range === "month"
              ? { range: "month" }
              : { range: "day", date: selectedDate },
      }),
    [range, selectedDate, selectedYear],
  );

  useEffect(() => {
    const keepTodayCurrent = () => {
      const currentToday = manilaDateValue();
      setSelectedDate((currentDate) => (currentDate === today ? currentToday : currentDate));
    };

    const interval = window.setInterval(keepTodayCurrent, 60_000);
    return () => window.clearInterval(interval);
  }, [today]);
  const { data: report, loading, error, reload } = useWorkspaceData(request);

  useEffect(() => {
    void getManagementDeliveryFee()
      .then((settings) => {
        setDeliveryFee(String(settings.deliveryFee));
        setDeliveryEnabled(settings.deliveryEnabled);
      })
      .catch(() => undefined);
  }, []);

  const loadDeliveryOperations = useCallback(() => {
    void getManagementDeliveryOperations()
      .then(setDeliveryOperations)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    loadDeliveryOperations();
    const interval = window.setInterval(loadDeliveryOperations, 30_000);
    return () => window.clearInterval(interval);
  }, [loadDeliveryOperations]);

  async function assignRider(orderNumber: string, riderId: string) {
    setAssigningOrder(orderNumber);
    try {
      await assignDeliveryRider({ data: { orderNumber, riderId } });
      loadDeliveryOperations();
      toast.success("Rider assigned", { description: `${orderNumber} is now in the Rider queue.` });
    } catch (cause) {
      toast.error("Could not assign Rider", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setAssigningOrder(null);
    }
  }

  async function saveDeliveryFee() {
    const nextFee = Number(deliveryFee);
    if (!Number.isFinite(nextFee) || nextFee < 0) {
      toast.error("Enter a valid delivery fee.");
      return;
    }
    setSavingDeliveryFee(true);
    try {
      const saved = await updateManagementDeliveryFee({ data: { deliveryFee: nextFee } });
      setDeliveryFee(String(saved.deliveryFee));
      toast.success("Delivery fee updated", {
        description: `Delivery orders will now add ₱${saved.deliveryFee.toFixed(2)}. Pickup stays free.`,
      });
    } catch (error) {
      toast.error("Could not update delivery fee", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSavingDeliveryFee(false);
    }
  }

  async function saveDeliveryAvailability(nextEnabled: boolean) {
    setSavingDeliveryAvailability(true);
    try {
      const saved = await updateManagementDeliveryAvailability({
        data: { deliveryEnabled: nextEnabled },
      });
      setDeliveryEnabled(saved.deliveryEnabled);
      toast.success(saved.deliveryEnabled ? "Delivery turned on" : "Delivery turned off", {
        description: saved.deliveryEnabled
          ? "Buyers can choose delivery at checkout."
          : "Buyers can choose pickup only until delivery is turned back on.",
      });
    } catch (error) {
      toast.error("Could not update delivery availability", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSavingDeliveryAvailability(false);
    }
  }
  const summaryByLabel = useMemo(
    () => new Map((report?.summaries ?? []).map((item) => [item.label, item])),
    [report],
  );
  const dashboardMetrics = [
    summaryByLabel.get("Stock added"),
    summaryByLabel.get("Supply received"),
    summaryByLabel.get("Sales completed"),
    summaryByLabel.get("Buyer orders"),
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const qualityColors = ["var(--primary)", "var(--semi)", "var(--destructive)"];

  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Operational Dashboard"
        description="Review a selected day or all saved operational records, including inventory, sales, supply, and buyer demand."
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="Management dashboard"
        />
        {!loading && !error && (
          <>
            <section className="rounded-3xl border border-primary/20 bg-accent p-5 text-sm text-accent-foreground">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <Database className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <h2 className="font-semibold">
                      {isAllTime
                        ? "All-time operational data"
                        : isMonthly
                          ? "This month's operational data"
                          : "Daily operational data"}
                    </h2>
                    <p className="mt-1 opacity-85">
                      {isAllTime
                        ? "Choose a calendar year to review saved history. Inventory flow is grouped by month."
                        : isMonthly
                          ? "This view groups live operational records by day for the current month."
                          : "This dashboard starts on today and refreshes as records are saved. Choose an earlier date to review its saved history."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAllTime ? (
                    <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium">
                      <span className="text-muted-foreground">Year</span>
                      <select
                        value={selectedYear}
                        onChange={(event) => setSelectedYear(Number(event.target.value))}
                        aria-label="Choose dashboard year"
                        className="min-w-16 bg-transparent font-semibold outline-none"
                      >
                        {(report?.availableYears ?? [selectedYear]).map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <DatePicker
                      value={selectedDate}
                      onValueChange={(value) => {
                        setSelectedDate(value);
                        setRange("day");
                      }}
                      max={today}
                      disabled={isMonthly}
                      ariaLabel="Choose dashboard date"
                      className="sm:min-w-44"
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={range === "day" && selectedDate === today}
                    onClick={() => {
                      setSelectedDate(today);
                      setRange("day");
                    }}
                  >
                    Today
                  </Button>
                  <Button
                    type="button"
                    variant={isMonthly ? "default" : "outline"}
                    className="rounded-xl"
                    disabled={isMonthly}
                    onClick={() => {
                      setSelectedDate(today);
                      setRange("month");
                    }}
                  >
                    This month
                  </Button>
                  <Button
                    type="button"
                    variant={isAllTime ? "default" : "outline"}
                    className="rounded-xl"
                    disabled={isAllTime}
                    onClick={() => setRange("all")}
                  >
                    All time
                  </Button>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <h2 className="text-lg font-semibold">Delivery fee</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This flat amount is added only to Delivery orders. Pickup always stays ₱0.00.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="delivery-fee">Fee (₱)</Label>
                    <Input
                      id="delivery-fee"
                      value={deliveryFee}
                      inputMode="decimal"
                      onChange={(event) =>
                        setDeliveryFee(event.target.value.replace(/[^0-9.]/g, ""))
                      }
                      className="w-40"
                      aria-describedby="delivery-fee-help"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void saveDeliveryFee()}
                    disabled={savingDeliveryFee}
                  >
                    {savingDeliveryFee ? "Saving…" : "Save delivery fee"}
                  </Button>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-muted/30 p-4">
                <div>
                  <p className="font-medium">Delivery checkout</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Turn this off when no Rider is available. Buyers will see pickup only.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      deliveryEnabled
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {deliveryEnabled ? "Delivery on" : "Delivery off"}
                  </span>
                  <Switch
                    id="delivery-enabled"
                    checked={deliveryEnabled}
                    disabled={savingDeliveryAvailability}
                    onCheckedChange={(checked) => void saveDeliveryAvailability(checked)}
                    aria-label="Enable delivery checkout"
                  />
                </div>
              </div>
              <p id="delivery-fee-help" className="mt-3 text-xs text-muted-foreground">
                Default fee: ₱59.00. Orders already placed keep the fee they were created with.
              </p>
            </section>

            <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Delivery dispatch</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Assign only orders prepared by the Marketer. Riders update trip progress from
                    their mobile workspace.
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  {deliveryOperations?.deliveries.length ?? 0} active
                </span>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {deliveryOperations?.deliveries.map((delivery) => (
                  <article
                    key={delivery.orderNumber}
                    className="rounded-2xl border border-border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                          {delivery.orderNumber}
                        </p>
                        <h3 className="mt-1 font-semibold">
                          {delivery.recipientName || delivery.buyer}
                        </h3>
                      </div>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        {delivery.fulfillmentStatus.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {delivery.deliveryAddress || "No structured address saved"}
                    </p>
                    <div className="mt-4">
                      <AppSelect
                        value={delivery.assignedRiderId ?? ""}
                        onValueChange={(riderId) => void assignRider(delivery.orderNumber, riderId)}
                        options={(deliveryOperations?.riders ?? []).map((rider) => ({
                          value: rider.id,
                          label: rider.name,
                        }))}
                        placeholder={
                          deliveryOperations?.riders.length ? "Assign a Rider" : "No active Riders"
                        }
                        disabled={
                          assigningOrder !== null ||
                          !["ready_for_dispatch", "rider_assigned"].includes(
                            delivery.fulfillmentStatus,
                          )
                        }
                        className="w-full justify-between"
                      />
                    </div>
                  </article>
                ))}
                {deliveryOperations && !deliveryOperations.deliveries.length ? (
                  <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground lg:col-span-2">
                    No delivery orders are ready for dispatch yet.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Operational overview</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isAllTime
                      ? "Saved results across all time."
                      : isMonthly
                        ? "Saved results for the current month."
                        : "Saved results for the selected day."}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                  <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                  {report?.range === "all"
                    ? "All time"
                    : report?.range === "month"
                      ? "This month"
                      : report?.date === today
                        ? "Today"
                        : "Historical day"}
                </span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {dashboardMetrics.map((item) => (
                  <article
                    key={item.label}
                    className="rounded-3xl border border-border bg-card p-5 shadow-card"
                  >
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-3 font-display text-3xl font-semibold text-primary">
                      {item.value}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Inventory flow</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isAllTime
                        ? "Monthly movement of received and classified products across all saved operations."
                        : isMonthly
                          ? "Daily movement of received and classified products this month."
                          : "Movement of received and classified products through your operations."}
                    </p>
                  </div>
                  <PackageOpen className="size-5 shrink-0 text-primary" />
                </div>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={report?.dashboard.inventoryFlow ?? []}
                      margin={{ top: 8, right: 16, bottom: 10, left: 8 }}
                    >
                      <defs>
                        <linearGradient id="management-stock-fill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="management-supply-fill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        interval={isAllTime ? "preserveStartEnd" : isMonthly ? 4 : 3}
                        minTickGap={isAllTime ? 16 : 32}
                        tickFormatter={(label) => (isAllTime ? String(label).split(" ")[0] : label)}
                        tickLine={false}
                        axisLine={false}
                        height={isAllTime ? 42 : 38}
                        tickMargin={10}
                        tick={{ fontSize: isAllTime ? 12 : 14 }}
                        padding={{ left: 12, right: 12 }}
                      />
                      <YAxis
                        domain={[0, 1000]}
                        ticks={[0, 250, 500, 750, 1000]}
                        unit=" kg"
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        width={58}
                        tickMargin={10}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value} kg`,
                          name === "stock" ? "Classified stock" : "Supply received",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="stock"
                        name="stock"
                        stroke="var(--primary)"
                        strokeWidth={3}
                        fill="url(#management-stock-fill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="supply"
                        name="supply"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        fill="url(#management-supply-fill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary" /> Classified stock
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[var(--chart-2)]" /> Supply received
                  </span>
                </div>
              </article>

              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Recent activity</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Latest updates across your operations.
                    </p>
                  </div>
                  <Clock3 className="size-5 shrink-0 text-primary" />
                </div>
                <div className="mt-5 divide-y divide-border/70">
                  {(report?.dashboard.recentActivity ?? []).map((item) => {
                    const style = activityStyle(item.kind);
                    const Icon = style.icon;
                    return (
                      <div
                        key={`${item.kind}-${item.time}-${item.title}`}
                        className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${style.color}`}
                        >
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                        <time
                          className="shrink-0 text-xs text-muted-foreground"
                          dateTime={item.time}
                        >
                          {relativeTime(item.time)}
                        </time>
                      </div>
                    );
                  })}
                  {(report?.dashboard.recentActivity ?? []).length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No operational updates for this period yet.
                    </p>
                  )}
                </div>
              </article>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-3">
              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Stock quality</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isAllTime
                        ? "Classified stock recorded across all time."
                        : isMonthly
                          ? "Classified stock added this month."
                          : "Classified stock added on the selected day."}
                    </p>
                  </div>
                  <PieChartIcon className="size-5 shrink-0 text-primary" />
                </div>
                <div className="mt-3 grid grid-cols-[0.85fr_1.15fr] items-center gap-2">
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={report?.dashboard.quality ?? []}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={38}
                          outerRadius={58}
                          paddingAngle={3}
                          stroke="var(--card)"
                          strokeWidth={2}
                        >
                          {(report?.dashboard.quality ?? []).map((item, index) => (
                            <Cell key={item.name} fill={qualityColors[index] ?? "var(--muted)"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`${value} kg`, "Stock"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2.5 text-sm">
                    {(report?.dashboard.quality ?? []).map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: qualityColors[index] ?? "var(--muted)" }}
                          />
                          {item.name}
                        </span>
                        <strong>{item.value} kg</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <h2 className="text-lg font-semibold">Decision support</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Compare supply, reserved demand, sales, and payment records in Management Reports.
                  The dashboard keeps every day's data available through the date picker.
                </p>
              </article>
              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <PackageOpen className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">Controlled operations</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Review users, receiving, products, sales, transactions, and reports from the
                      sidebar. Changes remain traceable in the database.
                    </p>
                  </div>
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </ManagementLayout>
  );
}
