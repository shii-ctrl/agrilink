import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCheck,
  Pencil,
  Plus,
  RefreshCw,
  Sprout,
  Trash2,
  Unlink,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { FarmerLayout, FarmerPageHeader } from "@/components/workspaces/farmer-layout";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/app-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  expenseCategories,
  expenseCategoryLabels,
  plantingInput,
  createPlantingInput,
  plantingExpenseInput,
  todayInManila,
} from "@/features/farmer/planting-costs";
import { peso } from "@/features/marketplace/products";
import { formatSellingQuantity } from "@/features/marketplace/selling-units";
import { toast } from "@/lib/ui/toast";
import { userFacingErrorMessage } from "@/lib/ui/user-facing-error";
import {
  createFarmerPlanting,
  updateFarmerPlanting,
  getFarmerPlantingWorkspace,
  saveFarmerPlantingExpense,
  removeFarmerPlantingExpense,
  setFarmerPlantingStatus,
  linkFarmerPlantingDelivery,
} from "@/services/farmer/planting-cost-server-functions";

export const Route = createFileRoute("/farmer/plantings")({ component: FarmerPlantingsPage });
type Workspace = Awaited<ReturnType<typeof getFarmerPlantingWorkspace>>;
type Planting = Workspace["plantings"][number];
type Expense = Planting["expenses"][number];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value));
}
function resultLabel(planting: Planting) {
  const value = planting.summary.profit;
  return value === null
    ? "No sales yet"
    : value === 0
      ? "Break even"
      : value > 0
        ? "Profit on recorded sales"
        : "Loss on recorded sales";
}
function FarmerPlantingsPage() {
  const request = useCallback(() => getFarmerPlantingWorkspace(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [query, setQuery] = useState("");
  const [plantingForm, setPlantingForm] = useState<Planting | "new" | null>(null);
  const [expenseForm, setExpenseForm] = useState<{ plantingId: string; expense?: Expense } | null>(
    null,
  );
  const [linkOpen, setLinkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const selected = data?.plantings.find((planting) => planting.id === selectedId);
  const visible = (data?.plantings ?? []).filter(
    (planting) =>
      (planting.status === "finished") === finished &&
      `${planting.name} ${planting.cropName}`.toLowerCase().includes(query.toLowerCase()),
  );
  const page = usePagination(visible, { pageSize: 6 });
  const expensePage = usePagination(selected?.expenses ?? []);
  const salesPage = usePagination(selected?.sales ?? []);

  function refresh() {
    void reload({ background: true }).catch(() =>
      toast.error("Unable to refresh records", {
        description: "Refresh the page to view the latest records.",
      }),
    );
  }
  async function act(action: () => Promise<unknown>, message: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
      toast.success(message);
      refresh();
    } catch (caught) {
      toast.error("Unable to save changes", { description: userFacingErrorMessage(caught) });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <FarmerLayout>
      {confirmationDialog}
      <FarmerPageHeader
        title="Costs & Profit"
        description="Record actual expenses for each planting and compare them with your PROCY sales."
      />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload().catch(() => undefined)}
          label="planting costs"
        />
        {!loading && !error && data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {selected ? (
                <Button variant="outline" onClick={() => setSelectedId(null)}>
                  <ArrowLeft className="size-4" />
                  Back to plantings
                </Button>
              ) : (
                <h2 className="text-xl font-semibold">My plantings</h2>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={refresh}>
                  <RefreshCw className="size-4" />
                  Refresh
                </Button>
                {!selected && (
                  <Button onClick={() => setPlantingForm("new")}>
                    <Plus className="size-4" />
                    New planting
                  </Button>
                )}
              </div>
            </div>
            {!selected ? (
              <>
                <section className="flex flex-wrap gap-3 rounded-3xl border border-border bg-card p-4">
                  <Input
                    aria-label="Search plantings"
                    placeholder="Search planting or crop"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      page.setPage(1);
                    }}
                    className="min-w-0 sm:max-w-sm"
                  />
                  <Button
                    variant={!finished ? "default" : "outline"}
                    aria-pressed={!finished}
                    onClick={() => {
                      setFinished(false);
                      page.setPage(1);
                    }}
                  >
                    Active
                  </Button>
                  <Button
                    variant={finished ? "default" : "outline"}
                    aria-pressed={finished}
                    onClick={() => {
                      setFinished(true);
                      page.setPage(1);
                    }}
                  >
                    Finished
                  </Button>
                </section>
                {!visible.length && (
                  <section className="rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
                    <Sprout className="mx-auto mb-3 size-9 text-primary" />
                    <h3 className="font-semibold">
                      {query
                        ? "No matching plantings"
                        : finished
                          ? "No finished plantings yet"
                          : "Start tracking your planting"}
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                      For example: String beans — October. Record the date and amount of each
                      expense from preparation to harvest.
                    </p>
                  </section>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {page.pageItems.map((planting) => (
                    <article
                      key={planting.id}
                      className="rounded-3xl border border-border bg-card p-6 shadow-card"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {planting.cropName}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">{planting.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Planted: {dateLabel(planting.plantedOn)}
                      </p>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-muted-foreground">Total expenses</dt>
                          <dd className="mt-1 font-semibold">
                            {peso(planting.summary.totalExpenses)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Recorded sales</dt>
                          <dd className="mt-1 font-semibold">
                            {peso(planting.summary.grossSales)}
                          </dd>
                        </div>
                      </dl>
                      <p
                        className={`mt-4 text-sm font-medium ${planting.summary.profit !== null && planting.summary.profit < 0 ? "text-destructive" : "text-primary"}`}
                      >
                        {resultLabel(planting)}
                        {planting.summary.profit !== null
                          ? ` · ${peso(planting.summary.profit)}`
                          : ""}
                      </p>
                      <Button
                        className="mt-5"
                        variant="outline"
                        onClick={() => {
                          setSelectedId(planting.id);
                          expensePage.setPage(1);
                          salesPage.setPage(1);
                        }}
                      >
                        View records
                      </Button>
                    </article>
                  ))}
                </div>
                <PaginationControls {...page} itemLabel="plantings" />
              </>
            ) : (
              <>
                <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {selected.cropName} · {selected.status === "active" ? "Active" : "Finished"}
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold">{selected.name}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Planted: {dateLabel(selected.plantedOn)}
                      </p>
                      {selected.notes && (
                        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                          {selected.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setPlantingForm(selected)}>
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await requestConfirmation({
                              title:
                                selected.status === "active"
                                  ? "Mark this planting as finished?"
                                  : "Reopen this planting?",
                              description:
                                "Expenses, deliveries, and sales history will remain in your records.",
                              confirmLabel: selected.status === "active" ? "Finished" : "Reopen",
                            })
                          )
                            void act(
                              () =>
                                setFarmerPlantingStatus({
                                  data: {
                                    plantingId: selected.id,
                                    status: selected.status === "active" ? "finished" : "active",
                                  },
                                }),
                              "Planting updated",
                            );
                        }}
                      >
                        <CheckCheck className="size-4" />
                        {selected.status === "active" ? "Mark as finished" : "Reopen"}
                      </Button>
                    </div>
                  </div>
                </section>
                <section className="grid gap-4 sm:grid-cols-3">
                  <Metric label="Total expenses" value={peso(selected.summary.totalExpenses)} />
                  <Metric label="Recorded PROCY sales" value={peso(selected.summary.grossSales)} />
                  <Metric
                    label={resultLabel(selected)}
                    value={selected.summary.profit === null ? "—" : peso(selected.summary.profit)}
                    negative={selected.summary.profit !== null && selected.summary.profit < 0}
                  />
                </section>
                <p className="text-sm text-muted-foreground">
                  {selected.summary.profit === null
                    ? "Only expenses are shown until sales are recorded. Link a delivery from this planting to include its sales."
                    : "Result = recorded sales − PROCY service fee − expenses. This may change as more expenses or sales are recorded."}{" "}
                  IPON is your savings and is separate from expenses.
                </p>
                <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
                    <div>
                      <h3 className="font-semibold">Expense records</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Actual expenses with their dates and amounts.
                      </p>
                    </div>
                    <Button onClick={() => setExpenseForm({ plantingId: selected.id })}>
                      <Plus className="size-4" />
                      Add expense
                    </Button>
                  </div>
                  {!selected.expenses.length && (
                    <p className="p-6 text-sm text-muted-foreground">
                      No expenses yet. Add seeds, fertilizer, labor, or other costs for this
                      planting.
                    </p>
                  )}
                  <div className="divide-y divide-border">
                    {expensePage.pageItems.map((expense) => (
                      <article
                        key={expense.id}
                        className="flex flex-wrap items-start justify-between gap-3 p-5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            {dateLabel(expense.occurredOn)} ·{" "}
                            {expenseCategoryLabels[
                              expense.category as keyof typeof expenseCategoryLabels
                            ] ?? expense.category}
                          </p>
                          <p className="mt-1 break-words font-medium">{expense.description}</p>
                          {expense.notes && (
                            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                              {expense.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="mr-2 font-semibold">{peso(Number(expense.amount))}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            aria-label={`Edit expense: ${expense.description}`}
                            onClick={() => setExpenseForm({ plantingId: selected.id, expense })}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={busy}
                            aria-label={`Remove expense: ${expense.description}`}
                            onClick={async () => {
                              if (
                                await requestConfirmation({
                                  title: "Remove this expense?",
                                  description: `${expense.description} · ${peso(Number(expense.amount))} will be removed from this planting's total.`,
                                  confirmLabel: "Remove",
                                  destructive: true,
                                })
                              )
                                void act(
                                  () =>
                                    removeFarmerPlantingExpense({
                                      data: { plantingId: selected.id, id: expense.id },
                                    }),
                                  "Expense removed from total",
                                );
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <PaginationControls {...expensePage} itemLabel="expenses" />
                </section>
                <div className="grid items-start gap-5 lg:grid-cols-2">
                  <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-semibold">Deliveries from this planting</h3>
                      <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
                        <Plus className="size-4" />
                        Link delivery
                      </Button>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Choose your own PROCY delivery from this planting. Each delivery can belong to
                      only one planting.
                    </p>
                    {!selected.deliveries.length && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No linked deliveries yet.
                      </p>
                    )}
                    <div className="mt-3 max-h-80 divide-y divide-border overflow-y-auto">
                      {selected.deliveries.map((receipt) => (
                        <article
                          key={receipt.id}
                          className="flex items-start justify-between gap-3 py-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {receipt.product} ·{" "}
                              {formatSellingQuantity(Number(receipt.quantity), receipt.sellingUnit)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {dateLabel(receipt.receivedAt)} · Ref{" "}
                              {receipt.id.slice(-8).toUpperCase()}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={busy}
                            aria-label={`Unlink delivery ${receipt.id.slice(-8)}`}
                            onClick={async () => {
                              if (
                                await requestConfirmation({
                                  title: "Unlink this delivery?",
                                  description:
                                    "Sales from this delivery will be removed from this planting's results. The original delivery and sales records will remain.",
                                  confirmLabel: "Unlink",
                                })
                              )
                                void act(
                                  () =>
                                    linkFarmerPlantingDelivery({
                                      data: {
                                        plantingId: selected.id,
                                        receivingId: receipt.id,
                                        linked: false,
                                      },
                                    }),
                                  "Delivery unlinked",
                                );
                            }}
                          >
                            <Unlink className="size-4" />
                          </Button>
                        </article>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
                    <h3 className="font-semibold">Sales, deductions, and cash</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Profit includes your IPON savings. Cash released shows only earnings already
                      paid to you.
                    </p>
                    <Link
                      to="/farmer/earnings"
                      className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
                    >
                      View delivery breakdowns and payout receipts
                    </Link>
                    <dl className="mt-4 space-y-3 text-sm">
                      {[
                        ["Gross sales", selected.summary.grossSales],
                        ["PROCY service fee", selected.summary.serviceFee],
                        ["IPON savings from sales", selected.summary.ipon],
                        ["Net cash earnings after deductions", selected.summary.netCashEarnings],
                        ["Awaiting buyer payment", selected.summary.awaitingBuyerPayment],
                        ["Available for payout", selected.summary.availableForPayout],
                        ["Cash released", selected.summary.cashReleased],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="shrink-0 font-medium">{peso(Number(value))}</dd>
                        </div>
                      ))}
                      {selected.summary.cashAfterExpenses !== null && (
                        <div className="flex justify-between gap-4 border-t border-border pt-3">
                          <dt>Net cash earnings minus expenses</dt>
                          <dd className="shrink-0 font-semibold">
                            {peso(selected.summary.cashAfterExpenses)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                      Expenses are personal records and do not automatically reduce your payout.
                      Sales and deductions come from your PROCY Earnings & IPON records.
                    </p>
                    <Button asChild size="sm" variant="outline" className="mt-4">
                      <Link to="/farmer/earnings">Earnings & IPON</Link>
                    </Button>
                  </section>
                </div>
                <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                  <div className="border-b border-border p-5">
                    <h3 className="font-semibold">Recorded sales from linked deliveries</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Includes online and walk-in sales. Updates automatically when a sale is
                      finalized.
                    </p>
                  </div>
                  {!selected.sales.length && (
                    <p className="p-6 text-sm text-muted-foreground">
                      No sales have been recorded in Earnings & IPON for the linked deliveries yet.
                    </p>
                  )}
                  <div className="divide-y divide-border">
                    {salesPage.pageItems.map((sale) => (
                      <article
                        key={sale.id}
                        className="flex flex-wrap justify-between gap-3 p-5 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {sale.orderNumber}
                            {sale.source === "walk_in" ? " · Walk-in" : ""}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {sale.product} · {sale.classification} ·{" "}
                            {formatSellingQuantity(Number(sale.quantity), sale.sellingUnit)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {sale.soldAt ? dateLabel(sale.soldAt) : "Finalized sale"} ·{" "}
                            {sale.status === "pending_payment"
                              ? "Awaiting buyer payment"
                              : sale.status === "available"
                                ? "Available for payout"
                                : "Cash released"}
                          </p>
                        </div>
                        <p className="font-semibold">{peso(Number(sale.grossAmount))}</p>
                      </article>
                    ))}
                  </div>
                  <PaginationControls {...salesPage} itemLabel="sales" />
                </section>
              </>
            )}
          </>
        )}
      </main>
      {plantingForm && (
        <PlantingForm
          key={plantingForm === "new" ? "new" : plantingForm.id}
          planting={plantingForm === "new" ? undefined : plantingForm}
          onClose={() => setPlantingForm(null)}
          onSaved={(id) => {
            setPlantingForm(null);
            setSelectedId(id);
            refresh();
          }}
        />
      )}
      {expenseForm && (
        <ExpenseForm
          key={expenseForm.expense?.id ?? "new"}
          {...expenseForm}
          currentTotal={
            data?.plantings.find((row) => row.id === expenseForm.plantingId)?.summary
              .totalExpenses ?? 0
          }
          onClose={() => setExpenseForm(null)}
          onSaved={() => {
            if (!expenseForm.expense) expensePage.setPage(1);
            setExpenseForm(null);
            refresh();
          }}
        />
      )}
      {linkOpen && selected && data && (
        <DeliveryForm
          planting={selected}
          receipts={data.unlinkedDeliveries}
          onClose={() => setLinkOpen(false)}
          onSaved={() => {
            salesPage.setPage(1);
            setLinkOpen(false);
            refresh();
          }}
        />
      )}
    </FarmerLayout>
  );
}

function Metric({
  label,
  value,
  negative = false,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-2 break-words text-2xl font-semibold ${negative ? "text-destructive" : ""}`}
      >
        {value}
      </p>
    </article>
  );
}

function PlantingForm({
  planting,
  onClose,
  onSaved,
}: {
  planting?: Planting | undefined;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [id] = useState(() => planting?.id ?? crypto.randomUUID());
  const [name, setName] = useState(planting?.name ?? "");
  const [cropName, setCropName] = useState(planting?.cropName ?? "");
  const [plantedOn, setPlantedOn] = useState(planting?.plantedOn ?? todayInManila());
  const [notes, setNotes] = useState(planting?.notes ?? "");
  const blankExpense = () => ({
    id: crypto.randomUUID(),
    category: "seeds",
    description: "",
    amount: "",
  });
  const [draftExpenses, setDraftExpenses] = useState(() => [blankExpense()]);
  const draftTotal =
    draftExpenses.reduce(
      (sum, row) =>
        sum +
        (Number.isFinite(Number(row.amount)) && Number(row.amount) > 0
          ? Math.round(Number(row.amount) * 100)
          : 0),
      0,
    ) / 100;
  function changeExpense(id: string, field: "category" | "description" | "amount", value: string) {
    setDraftExpenses((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent className={planting ? "sm:max-w-lg" : "sm:max-w-2xl"}>
        <DialogHeader>
          <DialogTitle>{planting ? "Edit planting" : "New planting"}</DialogTitle>
          <DialogDescription>Keep a separate record for each planting cycle.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending.current) return;
            pending.current = true;
            setSaving(true);
            try {
              const input = { id, name, cropName, plantedOn, notes };
              if (planting) {
                const validated = plantingInput.safeParse(input);
                if (!validated.success)
                  throw new Error(
                    validated.error.issues[0]?.message ?? "Check the planting details.",
                  );
                await updateFarmerPlanting({ data: validated.data });
              } else {
                const validated = createPlantingInput.safeParse({
                  ...input,
                  expenses: draftExpenses
                    .filter((row) => row.amount.trim() || row.description.trim())
                    .map((row) => ({ ...row, occurredOn: plantedOn, amount: Number(row.amount) })),
                });
                if (!validated.success)
                  throw new Error(
                    validated.error.issues[0]?.message ?? "Check the expense details.",
                  );
                await createFarmerPlanting({ data: validated.data });
              }
              toast.success("Planting saved");
              onSaved(id);
            } catch (error) {
              toast.error("Unable to save planting", {
                description: userFacingErrorMessage(error),
              });
            } finally {
              pending.current = false;
              setSaving(false);
            }
          }}
        >
          <fieldset disabled={saving} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="planting-name">Planting name</Label>
                <Input
                  id="planting-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="String beans — October 2026 / Plot 1"
                  required
                  minLength={2}
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planting-crop">Crop</Label>
                <Input
                  id="planting-crop"
                  value={cropName}
                  onChange={(event) => setCropName(event.target.value)}
                  placeholder="For example: String beans"
                  required
                  minLength={2}
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planting-date">
                  {planting ? "Planting date" : "Planting and initial expense date"}
                </Label>
                <Input
                  id="planting-date"
                  type="date"
                  value={plantedOn}
                  onChange={(event) => setPlantedOn(event.target.value)}
                  required
                  max={todayInManila()}
                  min="1900-01-01"
                />
              </div>
            </div>
            {!planting && (
              <p className="text-xs text-muted-foreground">
                Initial expenses in this form use the date selected above. After saving, you can add
                later expenses with their own dates.
              </p>
            )}
            {!planting && (
              <section className="space-y-4 rounded-2xl border border-border p-4">
                <div>
                  <h3 className="font-semibold">Expenses for this planting</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    List seeds, fertilizer, labor, and other costs. The total updates with each
                    entry.
                  </p>
                </div>
                {draftExpenses.map((row, index) => (
                  <div key={row.id} className="space-y-3 rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Expense {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove expense ${index + 1}`}
                        onClick={() =>
                          setDraftExpenses((rows) => rows.filter((entry) => entry.id !== row.id))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`initial-amount-${row.id}`}>Amount (₱)</Label>
                        <Input
                          id={`initial-amount-${row.id}`}
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          max="999999999"
                          step="0.01"
                          placeholder="300.00"
                          value={row.amount}
                          onChange={(event) => changeExpense(row.id, "amount", event.target.value)}
                          required={Boolean(row.description.trim())}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`initial-category-${row.id}`}>Expense category</Label>
                        <AppSelect
                          id={`initial-category-${row.id}`}
                          value={row.category}
                          disabled={saving}
                          onValueChange={(value) => changeExpense(row.id, "category", value)}
                          options={expenseCategories.map((value) => ({
                            value,
                            label: expenseCategoryLabels[value],
                          }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`initial-description-${row.id}`}>Expense description</Label>
                      <Input
                        id={`initial-description-${row.id}`}
                        placeholder="For example: String bean seeds"
                        value={row.description}
                        maxLength={255}
                        minLength={2}
                        onChange={(event) =>
                          changeExpense(row.id, "description", event.target.value)
                        }
                        required={Boolean(row.amount.trim())}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={draftExpenses.length >= 50}
                  onClick={() => setDraftExpenses((rows) => [...rows, blankExpense()])}
                >
                  <Plus className="size-4" />
                  Add another expense
                </Button>
              </section>
            )}
            <div className="space-y-2">
              <Label htmlFor="planting-notes">Notes (optional)</Label>
              <Textarea
                id="planting-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={2000}
              />
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              {!planting && (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/10 p-3"
                  role="status"
                  aria-live="polite"
                >
                  <div>
                    <span className="font-medium">Total expenses</span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved together with the planting.
                    </p>
                  </div>
                  <strong className="text-xl text-primary">{peso(draftTotal)}</strong>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">{saving ? "Saving…" : "Save planting"}</Button>
              </div>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseForm({
  plantingId,
  expense,
  currentTotal,
  onClose,
  onSaved,
}: {
  plantingId: string;
  expense?: Expense;
  currentTotal: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [id] = useState(() => expense?.id ?? crypto.randomUUID());
  const [occurredOn, setOccurredOn] = useState(expense?.occurredOn ?? todayInManila());
  const [category, setCategory] = useState(expense?.category ?? "seeds");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense?.amount ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const previewTotal =
    (Math.round(currentTotal * 100) -
      Math.round(Number(expense?.amount ?? 0) * 100) +
      (Number.isFinite(Number(amount)) && Number(amount) > 0
        ? Math.round(Number(amount) * 100)
        : 0)) /
    100;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>Enter the actual date and amount spent.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending.current) return;
            pending.current = true;
            setSaving(true);
            try {
              const validated = plantingExpenseInput.safeParse({
                id,
                plantingId,
                occurredOn,
                category,
                description,
                amount: Number(amount),
                notes,
              });
              if (!validated.success)
                throw new Error(validated.error.issues[0]?.message ?? "Check the expense details.");
              await saveFarmerPlantingExpense({
                data: {
                  ...validated.data,
                  editing: Boolean(expense),
                },
              });
              toast.success("Expense saved");
              onSaved();
            } catch (error) {
              toast.error("Unable to save expense", {
                description: userFacingErrorMessage(error),
              });
            } finally {
              pending.current = false;
              setSaving(false);
            }
          }}
        >
          <fieldset disabled={saving} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expense-date">Date</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={occurredOn}
                  onChange={(event) => setOccurredOn(event.target.value)}
                  required
                  max={todayInManila()}
                  min="1900-01-01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-amount">Amount (₱)</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="999999999"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  placeholder="300.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-category">Expense category</Label>
              <AppSelect
                id="expense-category"
                disabled={saving}
                value={category}
                onValueChange={setCategory}
                options={expenseCategories.map((value) => ({
                  value,
                  label: expenseCategoryLabels[value],
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-description">Description</Label>
              <Input
                id="expense-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                minLength={2}
                maxLength={255}
                placeholder="For example: String bean seeds / Fertilizer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-notes">Notes (optional)</Label>
              <Textarea
                id="expense-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={2000}
              />
            </div>
            <div className="rounded-xl bg-primary/10 p-3" role="status" aria-live="polite">
              <p className="text-sm text-muted-foreground">
                Total expenses after saving this entry
              </p>
              <p className="mt-1 text-xl font-semibold text-primary">{peso(previewTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Currently saved: {peso(currentTotal)}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">{saving ? "Saving…" : "Save expense"}</Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeliveryForm({
  planting,
  receipts,
  onClose,
  onSaved,
}: {
  planting: Planting;
  receipts: Workspace["unlinkedDeliveries"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [receivingId, setReceivingId] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const eligible = receipts.filter(
    (receipt) =>
      (!planting.productId || receipt.productId === planting.productId) &&
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(receipt.receivedAt)) >= planting.plantedOn,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link your delivery</DialogTitle>
          <DialogDescription>
            Choose only a harvest delivery from {planting.name}. Its sales will be included in this
            planting's results.
          </DialogDescription>
        </DialogHeader>
        {!eligible.length ? (
          <p className="text-sm text-muted-foreground">
            No eligible deliveries are available. A delivery must be recorded at PROCY, unlinked
            from other plantings, and for the same product as any existing linked deliveries.
          </p>
        ) : (
          <div className="space-y-4">
            <Label htmlFor="planting-delivery">PROCY delivery</Label>
            <AppSelect
              id="planting-delivery"
              value={receivingId}
              onValueChange={setReceivingId}
              disabled={saving}
              searchable
              options={eligible.map((receipt) => ({
                value: receipt.id,
                label: `${receipt.product} · ${formatSellingQuantity(Number(receipt.quantity), receipt.sellingUnit)}`,
                description: `${dateLabel(receipt.receivedAt)} · Ref ${receipt.id.slice(-8).toUpperCase()}`,
              }))}
              placeholder="Choose a delivery"
            />
            <p className="text-sm text-muted-foreground">
              Finalized online and walk-in sales from this delivery will be included automatically.
              Stock and payouts will remain unchanged.
            </p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving || !receivingId}
            onClick={async () => {
              if (pending.current) return;
              pending.current = true;
              setSaving(true);
              try {
                await linkFarmerPlantingDelivery({
                  data: { plantingId: planting.id, receivingId, linked: true },
                });
                toast.success("Delivery linked");
                onSaved();
              } catch (error) {
                toast.error("Unable to link delivery", {
                  description: userFacingErrorMessage(error),
                });
              } finally {
                pending.current = false;
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Link delivery"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
