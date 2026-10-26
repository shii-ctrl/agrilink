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
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { getManagementDashboard } from "@/services/marketplace/marketplace-server-functions";

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
  const [range, setRange] = useState<"day" | "month">("day");
  const isMonthly = range === "month";
  const request = useCallback(
    () =>
      getManagementDashboard({
        data: range === "month" ? { range: "month" } : { range: "day", date: selectedDate },
      }),
    [range, selectedDate],
  );

  useEffect(() => {
    const keepTodayCurrent = () => {
      const currentToday = manilaDateValue();
      setSelectedDate((currentDate) =>
        currentDate === today ? currentToday : currentDate,
      );
    };

    const interval = window.setInterval(keepTodayCurrent, 60_000);
    return () => window.clearInterval(interval);
  }, [today]);
  const { data: report, loading, error, reload } = useWorkspaceData(request);
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
        description="Review one saved operational day at a time, including inventory, sales, supply, and buyer demand."
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
                      {isMonthly ? "This month's operational data" : "Daily operational data"}
                    </h2>
                    <p className="mt-1 opacity-85">
                      {isMonthly
                        ? "This view groups live operational records by day for the current month."
                        : "This dashboard starts on today and refreshes as records are saved. Choose an earlier date to review its saved history."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={!isMonthly && selectedDate === today}
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
                </div>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Operational overview</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isMonthly ? "Saved results for the current month." : "Saved results for the selected day."}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                  <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                  {report?.range === "month" ? "This month" : report?.date === today ? "Today" : "Historical day"}
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
                      {isMonthly
                        ? "Daily movement of received and classified products this month."
                        : "Movement of received and classified products through your operations."}
                    </p>
                  </div>
                  <PackageOpen className="size-5 shrink-0 text-primary" />
                </div>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report?.dashboard.inventoryFlow ?? []} margin={{ left: -12, right: 8 }}>
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
                      <XAxis dataKey="label" interval={isMonthly ? 4 : 3} tickLine={false} axisLine={false} />
                      <YAxis unit=" kg" allowDecimals={false} tickLine={false} axisLine={false} />
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
                  <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-primary" /> Classified stock</span>
                  <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-[var(--chart-2)]" /> Supply received</span>
                </div>
              </article>

              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Recent activity</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Latest updates across your operations.</p>
                  </div>
                  <Clock3 className="size-5 shrink-0 text-primary" />
                </div>
                <div className="mt-5 divide-y divide-border/70">
                  {(report?.dashboard.recentActivity ?? []).map((item) => {
                    const style = activityStyle(item.kind);
                    const Icon = style.icon;
                    return (
                      <div key={`${item.kind}-${item.time}-${item.title}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${style.color}`}>
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                        <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.time}>
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
                        {isMonthly
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
