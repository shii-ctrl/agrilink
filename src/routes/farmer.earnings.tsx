import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronDown,
  Clock3,
  HandCoins,
  History,
  PiggyBank,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { useCallback, useState } from "react";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FarmerLayout, FarmerPageHeader } from "@/components/workspaces/farmer-layout";
import { formatSellingQuantity } from "@/features/marketplace/selling-units";
import {
  SettlementReceiptDialog,
  type SettlementReceipt,
} from "@/features/settlements/components/settlement-receipt-dialog";
import { settlementMoney } from "@/features/settlements/policy";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { getFarmerSettlementWorkspace } from "@/services/settlements/farmer-settlement-server-functions";

export const Route = createFileRoute("/farmer/earnings")({ component: FarmerEarnings });
type Workspace = Awaited<ReturnType<typeof getFarmerSettlementWorkspace>>;
type Delivery = Workspace["deliveries"][number];
const statusText = {
  pending_payment: "Awaiting buyer payment",
  available: "Ready to collect",
  paid: "Cash received",
};

function FarmerEarnings() {
  const request = useCallback(() => getFarmerSettlementWorkspace(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const [receipt, setReceipt] = useState<SettlementReceipt | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const releasedEarnings = data?.payouts.reduce((sum, payout) => sum + payout.netAmount, 0) ?? 0;
  const releasedIpon = data?.iponReleases.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const deliveries = (data?.deliveries ?? []).filter(
    (delivery) =>
      `${delivery.product} ${delivery.id} ${delivery.lines.map((line) => line.orderNumber).join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (!filter ||
        (filter === "available" && delivery.summary.availableCash > 0) ||
        (filter === "pending" && delivery.summary.awaitingPayment > 0) ||
        (filter === "paid" && delivery.summary.paidCash > 0) ||
        (filter === "unsold" && delivery.remainingQuantity > 0)),
  );
  const page = usePagination(deliveries, { pageSize: 6 });
  const payoutPage = usePagination(data?.payouts ?? [], { pageSize: 5 });
  const iponPage = usePagination(data?.iponReleases ?? [], { pageSize: 5 });
  const showPayout = (payout: Workspace["payouts"][number]) =>
    setReceipt({
      number: payout.payoutNumber,
      farmerName: payout.farmerName,
      releasedAt: payout.releasedAt,
      amount: payout.netAmount,
      kind: "earnings",
      grossAmount: payout.grossAmount,
      serviceFee: payout.serviceFee,
      iponContribution: payout.iponContribution,
    });
  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="My Earnings"
        description="See what sold, understand every deduction, and check the money you can collect."
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
            <section
              aria-label="My earnings summary"
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
              <SummaryCard
                label="Available earnings"
                value={data.availableTotal}
                icon={WalletCards}
                hint="Ready to collect from Accounting."
                featured
              />
              <SummaryCard
                label="Awaiting buyer payment"
                value={data.summary.awaitingPayment}
                icon={Clock3}
                hint="Sold, but the payment has not been recorded yet."
              />
              <SummaryCard
                label="Cash already received"
                value={releasedEarnings + releasedIpon}
                icon={HandCoins}
                hint={`Earnings: ${settlementMoney(releasedEarnings)} · IPON released: ${settlementMoney(releasedIpon)}`}
              />
              <SummaryCard
                label="Total sales"
                value={data.summary.grossSales}
                icon={ReceiptText}
                hint="Your share of recorded sales, before deductions."
              />
              <SummaryCard
                label="PROCY service fees"
                value={data.summary.serviceFee}
                icon={History}
                hint="Fees recorded against your sales. Breakdown below."
              />
              <SummaryCard
                label="Current IPON"
                value={data.iponBalance}
                icon={PiggyBank}
                hint="Your saved money, separate from cash you can collect."
              />
            </section>
            <details className="mt-5 rounded-2xl border border-border bg-card p-5 text-sm">
              <summary className="cursor-pointer font-semibold">
                How is my money calculated?
              </summary>
              <div className="mt-3 space-y-2 text-muted-foreground">
                <p>Sales − PROCY service fee − IPON savings = cash earnings.</p>
                <p>
                  For each sold kilogram, {settlementMoney(data.policy.serviceFeePerKilogram)} is a
                  service fee and {settlementMoney(data.policy.iponPerKilogram)} goes to IPON. For
                  other selling units, see the deductions recorded on each sale.
                </p>
                <p>
                  IPON is still your money, not a farming expense. It becomes eligible after buyer
                  payment and is normally released in December.
                </p>
                <p>
                  Sales and cash received are different. Only available earnings can be collected.
                  Farming expenses and profit are shown in Costs &amp; Profit.
                </p>
                <Button asChild variant="outline" className="mt-2 rounded-full">
                  <Link to="/farmer/plantings">View Costs &amp; Profit</Link>
                </Button>
              </div>
            </details>
            <section className="mt-8" aria-labelledby="delivery-earnings-title">
              <h2 id="delivery-earnings-title" className="text-xl font-semibold">
                Earnings by delivery
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow each delivery from received products to sales and cash collection. A delivery
                can have several statuses while it sells in parts.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input
                  aria-label="Search my delivery earnings"
                  placeholder="Search product, delivery reference, or order"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    page.setPage(1);
                  }}
                />
                <AppSelect
                  ariaLabel="Filter my delivery earnings"
                  value={filter}
                  onValueChange={(value) => {
                    setFilter(value);
                    page.setPage(1);
                  }}
                  options={[
                    { value: "", label: "All deliveries" },
                    { value: "available", label: "Ready to collect" },
                    { value: "pending", label: "Awaiting buyer payment" },
                    { value: "unsold", label: "Products remaining" },
                    { value: "paid", label: "Has received payouts" },
                  ]}
                />
              </div>
              <div className="mt-4 space-y-4">
                {page.pageItems.map((delivery) => (
                  <DeliveryCard
                    key={delivery.id}
                    delivery={delivery}
                    payouts={data.payouts}
                    onReceipt={showPayout}
                  />
                ))}
                {!deliveries.length && (
                  <EmptyCard
                    text={
                      data.deliveries.length
                        ? "No deliveries match your search or filter."
                        : "No deliveries yet. Once PROCY records your delivery, its products and earnings will appear here."
                    }
                  />
                )}
              </div>
              <PaginationControls {...page} itemLabel="deliveries" />
            </section>
            <section className="mt-8 grid gap-6 xl:grid-cols-2">
              <section className="rounded-3xl border border-border bg-card shadow-card">
                <HistoryHeader title="Payout history" />
                {data.payouts.length ? (
                  payoutPage.pageItems.map((payout) => (
                    <HistoryRow
                      key={payout.id}
                      number={payout.payoutNumber}
                      date={payout.releasedAt}
                      amount={payout.netAmount}
                      onReceipt={() => showPayout(payout)}
                    />
                  ))
                ) : (
                  <EmptyCard text="No earnings have been paid out yet." />
                )}
                <PaginationControls {...payoutPage} itemLabel="payouts" />
              </section>
              <section className="rounded-3xl border border-border bg-card shadow-card">
                <HistoryHeader title="IPON release history" />
                {data.iponReleases.length ? (
                  iponPage.pageItems.map((item) => (
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
                  ))
                ) : (
                  <EmptyCard text="Your IPON has not been released yet." />
                )}
                <PaginationControls {...iponPage} itemLabel="IPON releases" />
              </section>
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

function DeliveryCard({
  delivery,
  payouts,
  onReceipt,
}: {
  delivery: Delivery;
  payouts: Workspace["payouts"];
  onReceipt: (payout: Workspace["payouts"][number]) => void;
}) {
  const quantity = (value: number) => formatSellingQuantity(value, delivery.sellingUnit);
  const summary = delivery.summary;
  const salesPage = usePagination(delivery.lines, { pageSize: 5 });
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">{delivery.product}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Received at PROCY · {formatDate(delivery.receivedAt)}
          </p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            Delivery reference: {delivery.id}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Ready to collect</p>
          <p className="mt-1 text-2xl font-semibold text-primary">
            {settlementMoney(summary.availableCash)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-5 pb-4 text-xs font-medium">
        {delivery.availableQuantity > 0 && <Status label="Products remaining" />}
        {delivery.reservedQuantity > 0 && <Status label="Buyer order in progress" />}
        {summary.awaitingPayment > 0 && <Status label="Awaiting buyer payment" />}
        {summary.availableCash > 0 && <Status label="Ready to collect" />}
        {summary.paidCash > 0 && <Status label="Cash received" />}
        {!delivery.lines.length && delivery.remainingQuantity === 0 && (
          <Status label="Received · no sales recorded" />
        )}
      </div>
      <dl className="grid grid-cols-2 gap-4 border-y border-border bg-muted/25 p-5 sm:grid-cols-4">
        {[
          ["Accepted", Number(delivery.receivedQuantity)],
          ["Sold", delivery.soldQuantity],
          ["Remaining", delivery.remainingQuantity],
          ["In buyer orders", delivery.reservedQuantity],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-semibold">{quantity(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-medium [&::-webkit-details-marker]:hidden">
          View sales and deductions{" "}
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-5 border-t border-border p-5">
          <div>
            <h4 className="font-semibold">Your products</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {delivery.classifications.map((row) => (
                <div
                  key={row.classification}
                  className="rounded-2xl border border-border p-3 text-sm"
                >
                  <p className="font-semibold">{row.classification}</p>
                  <p className="mt-2 text-muted-foreground">
                    Accepted: {quantity(row.receivedQuantity)}
                  </p>
                  <p className="text-muted-foreground">Sold: {quantity(row.soldQuantity)}</p>
                  <p className="text-muted-foreground">
                    Remaining: {quantity(row.remainingQuantity)}
                  </p>
                  {row.reservedQuantity > 0 && (
                    <p className="text-muted-foreground">
                      In buyer orders: {quantity(row.reservedQuantity)}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Remaining includes products in confirmed buyer orders. They become sold only after
              fulfillment is completed.
            </p>
          </div>
          <dl className="grid gap-2 rounded-2xl bg-muted/35 p-4 text-sm">
            <MoneyRow label="Sales before deductions" value={summary.grossSales} />
            <MoneyRow label="PROCY service fee" value={-summary.serviceFee} />
            <MoneyRow label="Saved to IPON (still yours)" value={-summary.iponSavings} />
            <MoneyRow label="Cash earnings after deductions" value={summary.netEarnings} strong />
            <div className="my-1 border-t border-border" />
            <MoneyRow label="Awaiting buyer payment" value={summary.awaitingPayment} />
            <MoneyRow label="Ready to collect" value={summary.availableCash} strong />
            <MoneyRow label="Cash already received from earnings" value={summary.paidCash} />
          </dl>
          <div>
            <h4 className="font-semibold">Sales from this delivery</h4>
            {!delivery.lines.length && (
              <p className="mt-2 text-sm text-muted-foreground">
                No sales recorded yet. Your accepted products will stay here while waiting to be
                sold.
              </p>
            )}
            <div className="mt-3 space-y-3">
              {salesPage.pageItems.map((line) => {
                const payout = payouts.find((item) => item.id === line.payoutId);
                return (
                  <article key={line.id} className="rounded-2xl border border-border p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="break-all font-medium">{line.orderNumber}</p>
                      <Status label={statusText[line.status]} />
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {line.classification} · {quantity(Number(line.quantity))} ×{" "}
                      {settlementMoney(Number(line.pricePerUnit))}
                      {line.source === "walk_in" ? " · Walk-in sale" : " · Online sale"}
                    </p>
                    {line.soldAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sold {formatDate(line.soldAt)}
                      </p>
                    )}
                    <dl className="mt-3 space-y-2">
                      <MoneyRow label="Your sales share" value={Number(line.grossAmount)} />
                      <MoneyRow label="PROCY service fee" value={-Number(line.serviceFee)} />
                      <MoneyRow label="IPON savings" value={-Number(line.iponContribution)} />
                      <MoneyRow label="Your cash earnings" value={Number(line.netAmount)} strong />
                    </dl>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {line.status === "pending_payment"
                        ? "Accounting has not recorded buyer payment yet. This cash cannot be collected yet."
                        : line.status === "available"
                          ? "Buyer payment is recorded. You can collect these cash earnings from Accounting."
                          : `Cash release recorded${line.paidAt ? ` on ${formatDate(line.paidAt)}` : ""}.`}
                    </p>
                    {payout && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 rounded-full"
                        onClick={() => onReceipt(payout)}
                      >
                        View payout receipt
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
            <PaginationControls {...salesPage} itemLabel="sales" />
          </div>
        </div>
      </details>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  hint,
  featured = false,
}: {
  label: string;
  value: number;
  icon: typeof WalletCards;
  hint: string;
  featured?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border p-5 shadow-card ${featured ? "border-primary/30 bg-accent" : "border-border bg-card"}`}
    >
      <Icon className="size-5 text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-display text-3xl font-semibold">
        {settlementMoney(value)}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </article>
  );
}
function Status({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
      {label}
    </span>
  );
}
function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd className="shrink-0 text-right">{settlementMoney(value)}</dd>
    </div>
  );
}
function HistoryHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-border p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Open a receipt to print or save it as a PDF.
      </p>
    </div>
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 last:border-b-0">
      <div className="min-w-0">
        <p className="break-all font-medium">{number}</p>
        <p className="text-sm text-muted-foreground">{formatDate(date)} · Cash</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
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
    <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(
    new Date(value),
  );
}
