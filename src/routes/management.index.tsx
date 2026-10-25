import { createFileRoute } from "@tanstack/react-router";
import { Database, PackageOpen, PieChart as PieChartIcon, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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

function ManagementDashboard() {
  const today = manilaDateValue();
  const [selectedDate, setSelectedDate] = useState(today);
  const request = useCallback(
    () => getManagementDashboard({ data: { date: selectedDate } }),
    [selectedDate],
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
    summaryByLabel.get("Available stock"),
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
                  <h2 className="font-semibold">Daily operational data</h2>
                  <p className="mt-1 opacity-85">
                    This dashboard starts on today and refreshes as records are saved. Choose an
                    earlier date to review the saved history for that day.
                  </p>
                </div>
                </div>
                <div className="flex items-center gap-2">
                  <DatePicker
                    value={selectedDate}
                    onValueChange={setSelectedDate}
                    max={today}
                    ariaLabel="Choose dashboard date"
                    className="sm:min-w-44"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={selectedDate === today}
                    onClick={() => setSelectedDate(today)}
                  >
                    Today
                  </Button>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Operational overview</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Saved results for the selected day.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                  <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                  {report?.date === today ? "Today" : "Historical day"}
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
                    <h2 className="text-lg font-semibold">Sales and order activity</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Buyer orders and completed sales by hour for the selected day.
                    </p>
                  </div>
                  <TrendingUp className="size-5 shrink-0 text-primary" />
                </div>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report?.dashboard.activity ?? []} margin={{ left: -12, right: 8 }}>
                      <defs>
                        <linearGradient id="management-sales-fill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" interval={3} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          value,
                          name === "sales" ? "Sales completed" : "Buyer orders",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        name="sales"
                        stroke="var(--primary)"
                        strokeWidth={3}
                        fill="url(#management-sales-fill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="orders"
                        name="orders"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fill="transparent"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-primary" /> Sales completed</span>
                  <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-[var(--chart-2)]" /> Buyer orders</span>
                </div>
              </article>

              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Stock quality</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Classified stock at the end of the selected day.
                    </p>
                  </div>
                  <PieChartIcon className="size-5 shrink-0 text-primary" />
                </div>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip formatter={(value: number) => [`${value} kg`, "Available"]} />
                      <Pie
                        data={report?.dashboard.quality ?? []}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={3}
                      >
                        {(report?.dashboard.quality ?? []).map((item, index) => (
                          <Cell key={item.name} fill={qualityColors[index] ?? "var(--muted)"} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {(report?.dashboard.quality ?? []).map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span
                          className="size-2.5 rounded-sm"
                          style={{ backgroundColor: qualityColors[index] ?? "var(--muted)" }}
                        />
                        {item.name}
                      </span>
                      <span className="font-semibold">{item.value} kg</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Available stock by product</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      End-of-day quantities after reservations. Top 10 products are shown.
                    </p>
                  </div>
                  <PackageOpen className="size-5 shrink-0 text-primary" />
                </div>
                <div className="mt-6 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report?.dashboard.stockByProduct ?? []} margin={{ left: -12, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis unit=" kg" tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => [`${value} kg`, "Available stock"]} />
                      <Bar dataKey="value" name="Available stock" fill="var(--primary)" radius={[7, 7, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <div className="grid gap-6">
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
              </div>
            </section>
          </>
        )}
      </main>
    </ManagementLayout>
  );
}
