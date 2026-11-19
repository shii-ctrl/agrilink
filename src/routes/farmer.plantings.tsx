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
    ? "Wala pang benta"
    : value === 0
      ? "Break even"
      : value > 0
        ? "Tubo sa naitalang benta"
        : "Lugi sa naitalang benta";
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
      toast.error("Hindi ma-refresh ang talaan", {
        description: "I-refresh ang page para makita ang pinakabagong records.",
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
      toast.error("Hindi na-save ang pagbabago", { description: userFacingErrorMessage(caught) });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <FarmerLayout>
      {confirmationDialog}
      <FarmerPageHeader
        title="Gastos at Tubo"
        description="Itala ang aktuwal na gastos sa bawat taniman at ihambing sa sariling benta sa PROCY."
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
                  Mga taniman
                </Button>
              ) : (
                <h2 className="text-xl font-semibold">Mga taniman ko</h2>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={refresh}>
                  <RefreshCw className="size-4" />
                  Refresh
                </Button>
                {!selected && (
                  <Button onClick={() => setPlantingForm("new")}>
                    <Plus className="size-4" />
                    Bagong taniman
                  </Button>
                )}
              </div>
            </div>
            {!selected ? (
              <>
                <section className="flex flex-wrap gap-3 rounded-3xl border border-border bg-card p-4">
                  <Input
                    aria-label="Search plantings"
                    placeholder="Hanapin ang taniman o pananim"
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
                    Kasalukuyan
                  </Button>
                  <Button
                    variant={finished ? "default" : "outline"}
                    aria-pressed={finished}
                    onClick={() => {
                      setFinished(true);
                      page.setPage(1);
                    }}
                  >
                    Tapos na
                  </Button>
                </section>
                {!visible.length && (
                  <section className="rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
                    <Sprout className="mx-auto mb-3 size-9 text-primary" />
                    <h3 className="font-semibold">
                      {query
                        ? "Walang tugmang taniman"
                        : finished
                          ? "Wala pang natapos na taniman"
                          : "Simulan ang talaan ng iyong taniman"}
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                      Halimbawa: Sitaw — October. Idagdag ang petsa at halaga ng bawat gastos mula
                      paghahanda hanggang harvest.
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
                        Tinanim: {dateLabel(planting.plantedOn)}
                      </p>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-muted-foreground">Total gastos</dt>
                          <dd className="mt-1 font-semibold">
                            {peso(planting.summary.totalExpenses)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Naitalang benta</dt>
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
                        Tingnan ang talaan
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
                        {selected.cropName} ·{" "}
                        {selected.status === "active" ? "Kasalukuyan" : "Tapos na"}
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold">{selected.name}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Tinanim: {dateLabel(selected.plantedOn)}
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
                                  ? "Tapos na ang taniman?"
                                  : "Ibalik sa kasalukuyang taniman?",
                              description:
                                "Mananatili ang gastos, deliveries, at sales history sa talaan.",
                              confirmLabel: selected.status === "active" ? "Tapos na" : "Ibalik",
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
                              "Na-update ang taniman",
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
                  <Metric label="Total gastos" value={peso(selected.summary.totalExpenses)} />
                  <Metric
                    label="Naitalang benta sa PROCY"
                    value={peso(selected.summary.grossSales)}
                  />
                  <Metric
                    label={resultLabel(selected)}
                    value={selected.summary.profit === null ? "—" : peso(selected.summary.profit)}
                    negative={selected.summary.profit !== null && selected.summary.profit < 0}
                  />
                </section>
                <p className="text-sm text-muted-foreground">
                  {selected.summary.profit === null
                    ? "Total gastos muna ang ipinapakita habang wala pang naitalang benta. I-link ang delivery mula sa tanimang ito para maisama ang sales."
                    : "Resulta = naitalang benta − PROCY service fee − gastos. Maaaring magbago habang may dagdag na gastos o benta."}{" "}
                  Ang IPON ay sariling savings at hiwalay sa gastos.
                </p>
                <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
                    <div>
                      <h3 className="font-semibold">Talaan ng gastos</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Aktuwal na nagastos, kasama ang petsa at halaga.
                      </p>
                    </div>
                    <Button onClick={() => setExpenseForm({ plantingId: selected.id })}>
                      <Plus className="size-4" />
                      Magdagdag ng gastos
                    </Button>
                  </div>
                  {!selected.expenses.length && (
                    <p className="p-6 text-sm text-muted-foreground">
                      Wala pang gastos. Idagdag ang buto, pataba, labor, o iba pang nagastos sa
                      tanimang ito.
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
                                  title: "Alisin ang gastos?",
                                  description: `${expense.description} · ${peso(Number(expense.amount))} ay aalisin sa total ng tanimang ito.`,
                                  confirmLabel: "Alisin",
                                  destructive: true,
                                })
                              )
                                void act(
                                  () =>
                                    removeFarmerPlantingExpense({
                                      data: { plantingId: selected.id, id: expense.id },
                                    }),
                                  "Naalis ang gastos sa total",
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
                      <h3 className="font-semibold">Deliveries mula sa tanimang ito</h3>
                      <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
                        <Plus className="size-4" />
                        I-link ang delivery
                      </Button>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Piliin ang sariling PROCY delivery na galing sa tanimang ito. Isang taniman
                      lang bawat delivery.
                    </p>
                    {!selected.deliveries.length && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Wala pang naka-link na delivery.
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
                                  title: "Alisin ang delivery link?",
                                  description:
                                    "Mawawala sa resulta ng tanimang ito ang benta mula sa delivery. Mananatili ang original delivery at sales records.",
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
                                  "Naalis ang delivery link",
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
                    <h3 className="font-semibold">Benta, deductions, at cash</h3>
                    <dl className="mt-4 space-y-3 text-sm">
                      {[
                        ["Kabuuang benta", selected.summary.grossSales],
                        ["PROCY service fee", selected.summary.serviceFee],
                        ["IPON mula sa benta", selected.summary.ipon],
                        [
                          "Net cash earnings pagkatapos ng deductions",
                          selected.summary.netCashEarnings,
                        ],
                        ["Hinihintay pang bayad ng buyer", selected.summary.awaitingBuyerPayment],
                        ["Available para sa payout", selected.summary.availableForPayout],
                        ["Cash na na-release", selected.summary.cashReleased],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="shrink-0 font-medium">{peso(Number(value))}</dd>
                        </div>
                      ))}
                      {selected.summary.cashAfterExpenses !== null && (
                        <div className="flex justify-between gap-4 border-t border-border pt-3">
                          <dt>Net cash earnings minus gastos</dt>
                          <dd className="shrink-0 font-semibold">
                            {peso(selected.summary.cashAfterExpenses)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                      Ang gastos ay personal na talaan; walang awtomatikong bawas sa payout. Ang
                      benta at deductions ay mula sa Earnings & IPON records mo sa PROCY.
                    </p>
                    <Button asChild size="sm" variant="outline" className="mt-4">
                      <Link to="/farmer/earnings">Earnings & IPON</Link>
                    </Button>
                  </section>
                </div>
                <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                  <div className="border-b border-border p-5">
                    <h3 className="font-semibold">Naitalang sales mula sa linked deliveries</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Kasama ang online at walk-in sales. Automatic ang pag-update kapag na-finalize
                      ang benta.
                    </p>
                  </div>
                  {!selected.sales.length && (
                    <p className="p-6 text-sm text-muted-foreground">
                      Wala pang naitalang benta sa Earnings & IPON mula sa linked deliveries.
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
          <DialogTitle>{planting ? "Edit taniman" : "Bagong taniman"}</DialogTitle>
          <DialogDescription>
            Magkahiwalay na talaan para sa bawat planting cycle.
          </DialogDescription>
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
                    validated.error.issues[0]?.message ?? "Suriin ang detalye ng taniman.",
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
                    validated.error.issues[0]?.message ?? "Suriin ang detalye ng gastos.",
                  );
                await createFarmerPlanting({ data: validated.data });
              }
              toast.success("Na-save ang taniman");
              onSaved(id);
            } catch (error) {
              toast.error("Hindi na-save ang taniman", {
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
                <Label htmlFor="planting-name">Pangalan ng taniman</Label>
                <Input
                  id="planting-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Sitaw — October 2026 / Plot 1"
                  required
                  minLength={2}
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planting-crop">Pananim</Label>
                <Input
                  id="planting-crop"
                  value={cropName}
                  onChange={(event) => setCropName(event.target.value)}
                  placeholder="Halimbawa: Sitaw"
                  required
                  minLength={2}
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planting-date">
                  {planting ? "Petsa ng pagtatanim" : "Petsa ng pagtatanim at unang gastos"}
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
                Ang mga unang gastos sa form na ito ay gagamit ng petsang pinili sa itaas. Maaaring
                magdagdag ng susunod na gastos na may sariling petsa pagkatapos ma-save.
              </p>
            )}
            {!planting && (
              <section className="space-y-4 rounded-2xl border border-border p-4">
                <div>
                  <h3 className="font-semibold">Mga nagastos sa tanimang ito</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ilista ang buto, pataba, labor, at iba pa. Nadadagdagan ang total kada entry.
                  </p>
                </div>
                {draftExpenses.map((row, index) => (
                  <div key={row.id} className="space-y-3 rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Gastos {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Alisin ang gastos ${index + 1}`}
                        onClick={() =>
                          setDraftExpenses((rows) => rows.filter((entry) => entry.id !== row.id))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`initial-amount-${row.id}`}>Halaga (₱)</Label>
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
                        <Label htmlFor={`initial-category-${row.id}`}>Uri ng gastos</Label>
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
                      <Label htmlFor={`initial-description-${row.id}`}>Detalye ng gastos</Label>
                      <Input
                        id={`initial-description-${row.id}`}
                        placeholder="Halimbawa: Buto ng sitaw"
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
                  Magdagdag pa ng gastos
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
                    <span className="font-medium">Kabuuang nagastos</span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Mase-save kasama ng taniman.
                    </p>
                  </div>
                  <strong className="text-xl text-primary">{peso(draftTotal)}</strong>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">{saving ? "Saving…" : "I-save ang taniman"}</Button>
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
          <DialogTitle>{expense ? "Edit gastos" : "Magdagdag ng gastos"}</DialogTitle>
          <DialogDescription>Ilagay ang aktuwal na petsa at halagang nagastos.</DialogDescription>
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
                throw new Error(
                  validated.error.issues[0]?.message ?? "Suriin ang detalye ng gastos.",
                );
              await saveFarmerPlantingExpense({
                data: {
                  ...validated.data,
                  editing: Boolean(expense),
                },
              });
              toast.success("Na-save ang gastos");
              onSaved();
            } catch (error) {
              toast.error("Hindi na-save ang gastos", {
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
                <Label htmlFor="expense-date">Petsa</Label>
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
                <Label htmlFor="expense-amount">Halaga (₱)</Label>
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
              <Label htmlFor="expense-category">Uri ng gastos</Label>
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
              <Label htmlFor="expense-description">Detalye</Label>
              <Input
                id="expense-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                minLength={2}
                maxLength={255}
                placeholder="Halimbawa: Buto ng sitaw / Pataba"
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
              <p className="text-sm text-muted-foreground">Total gastos kapag na-save ang entry</p>
              <p className="mt-1 text-xl font-semibold text-primary">{peso(previewTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Kasalukuyang naka-save: {peso(currentTotal)}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">{saving ? "Saving…" : "I-save ang gastos"}</Button>
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
          <DialogTitle>I-link ang sariling delivery</DialogTitle>
          <DialogDescription>
            Piliin lamang ang harvest mula sa {planting.name}. Dito ibabase ang sales ng tanimang
            ito.
          </DialogDescription>
        </DialogHeader>
        {!eligible.length ? (
          <p className="text-sm text-muted-foreground">
            Walang available na delivery para sa tanimang ito. Dapat recorded na sa PROCY, hindi
            naka-link sa ibang taniman, at kaparehong product ng naunang linked delivery.
          </p>
        ) : (
          <div className="space-y-4">
            <Label htmlFor="planting-delivery">Delivery sa PROCY</Label>
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
              placeholder="Piliin ang delivery"
            />
            <p className="text-sm text-muted-foreground">
              Automatic na maisasama ang finalized online at walk-in sales mula sa delivery na ito.
              Hindi mababago ang stock o payout.
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
                toast.success("Na-link ang delivery");
                onSaved();
              } catch (error) {
                toast.error("Hindi na-link ang delivery", {
                  description: userFacingErrorMessage(error),
                });
              } finally {
                pending.current = false;
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "I-link ang delivery"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
