import { createFileRoute } from "@tanstack/react-router";
import { CircleDollarSign, Clock3, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountingLayout, AccountingPageHeader } from "@/components/workspaces/accounting-layout";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { Label } from "@/components/ui/label";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { type DemoOrder } from "@/lib/demo/demo-orders";
import { formatSellingQuantity, sellingUnitLabel } from "@/features/marketplace/selling-units";
import {
  getDatabaseOrders,
  recordDatabasePayment,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/accounting/payments")({ component: AccountingPaymentsPage });

function paymentMethodLabel(method: string | null | undefined) {
  if (method === "cash_on_delivery") return "Cash on Delivery (COD)";
  if (method === "cash") return "Cash";
  if (method === "bank_transfer") return "Bank Transfer";
  if (method === "manual_reference") return "Other recorded method";
  return method ?? "Recorded method";
}

function AccountingPaymentReceipt({ order }: { order: DemoOrder }) {
  const items = order.items?.length
    ? order.items
    : [
        {
          listingId: order.id,
          name: order.product,
          classification: order.classification,
          quantityKg: Number.parseFloat(order.quantity) || 0,
          pricePerKg: 0,
          sellingUnit: "kg" as const,
        },
      ];
  const units = new Set(items.map((item) => item.sellingUnit ?? "kg"));
  const totalQuantity = items.reduce((total, item) => total + item.quantityKg, 0);
  const quantitySummary =
    units.size === 1
      ? formatSellingQuantity(totalQuantity, items[0]?.sellingUnit ?? "kg")
      : `${items.length} classified items`;
  const fulfillment = order.fulfillmentMethod === "delivery" ? "Delivery" : "Pickup";
  const itemTotal = items.reduce((total, item) => total + item.quantityKg * item.pricePerKg, 0);

  return (
    <section className="accounting-payment-receipt hidden bg-white p-8 text-black">
      <div className="mx-auto max-w-2xl border border-slate-300 bg-white p-8 text-slate-950">
        <div className="flex items-start justify-between gap-6 border-b border-slate-300 pb-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              AgriLink
            </p>
            <h1 className="mt-2 text-3xl font-bold">Payment receipt</h1>
            <p className="mt-1 text-sm text-slate-600">PROCY marketplace payment record</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{order.paymentId ?? "Payment recorded"}</p>
            <p className="mt-1 text-slate-600">Paid {order.paidAt ?? order.date}</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">Buyer</dt>
            <dd className="mt-1 font-semibold">{order.buyer}</dd>
            <dd className="text-slate-700">{order.contact}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Fulfillment</dt>
            <dd className="mt-1 font-semibold">{fulfillment}</dd>
            <dd className="whitespace-pre-wrap text-slate-700">{order.pickupNote}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Payment method</dt>
            <dd className="mt-1 font-semibold">{paymentMethodLabel(order.paymentMethod)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Order reference</dt>
            <dd className="mt-1 font-semibold">{order.id}</dd>
            <dd className="text-slate-700">Completed {order.soldAt ?? order.date}</dd>
          </div>
        </dl>

        <div className="mt-6 overflow-hidden border border-slate-300">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <span>Product</span>
            <span>Quantity</span>
            <span>Price</span>
          </div>
          {items.map((item) => (
            <div
              key={item.listingId}
              className="grid grid-cols-[1fr_auto_auto] gap-4 border-t border-slate-200 px-4 py-3 text-sm"
            >
              <span>
                <span className="block font-semibold">{item.name}</span>
                <span className="text-slate-600">{item.classification}</span>
              </span>
              <span>{formatSellingQuantity(item.quantityKg, item.sellingUnit ?? "kg")}</span>
              <span>
                {item.pricePerKg > 0
                  ? `₱${item.pricePerKg.toFixed(2)} / ${sellingUnitLabel(item.sellingUnit ?? "kg")}`
                  : "Included"}
              </span>
            </div>
          ))}
          {order.deliveryFee && order.deliveryFee > 0 ? (
            <>
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
                <span>Products subtotal</span>
                <span>₱{itemTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
                <span>Delivery fee</span>
                <span>₱{order.deliveryFee.toFixed(2)}</span>
              </div>
            </>
          ) : null}
          <div className="flex items-center justify-between border-t-2 border-slate-400 px-4 py-4">
            <span className="font-semibold">Total paid · {quantitySummary}</span>
            <span className="text-xl font-bold">{order.total}</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Issued by Accounting after receipt of payment. Keep this as the buyer's payment record.
        </p>
      </div>
    </section>
  );
}

function AccountingPaymentsPage() {
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [method, setMethod] = useState("");
  const [receiptOrder, setReceiptOrder] = useState<DemoOrder | null>(null);

  useEffect(() => {
    void getDatabaseOrders()
      .then(setOrders)
      .catch(() => toast.error("Could not load payments."));
  }, []);
  useAutoRefresh(() =>
    getDatabaseOrders()
      .then(setOrders)
      .catch(() => undefined),
  );

  const awaitingPayment = useMemo(
    () => orders.filter((order) => order.status === "Sold" && order.paymentStatus === "Unpaid"),
    [orders],
  );
  const recordedPayments = useMemo(
    () => orders.filter((order) => order.paymentStatus === "Paid"),
    [orders],
  );
  const selectedOrder = awaitingPayment.find((order) => order.id === selectedOrderId);

  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder || !method) return;

    try {
      const result = await recordDatabasePayment({
        data: {
          orderNumber: selectedOrder.id,
          method: method as "cash" | "cash_on_delivery",
        },
      });
      setOrders(await getDatabaseOrders());
      setSelectedOrderId("");
      setMethod("");
      toast.success("Payment recorded as Paid", {
        description: `${result.paymentNumber} is now linked to ${selectedOrder.id}.`,
      });
    } catch (error) {
      toast.error("Payment could not be recorded", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  function printReceipt(order: DemoOrder) {
    setReceiptOrder(order);
    window.requestAnimationFrame(() => window.print());
  }

  return (
    <AccountingLayout>
      <div className="accounting-payment-screen print:hidden">
        <AccountingPageHeader
          title="Record Payment"
          description="Record payment after a PROCY order is marked Sold. This page records payment information and does not process online payments."
        />
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
          <div className="mb-6 flex gap-3 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
            <Clock3 className="mt-0.5 size-5 shrink-0" />
            <p>
              <span className="font-semibold">Accounting scope:</span> verify the order total and
              delivery fee, record Cash or COD only after money is received, then issue the receipt.
              Preparing orders, assigning Riders, and changing delivery progress stay with
              Operations.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <div className="flex gap-3">
                <CircleDollarSign className="mt-0.5 size-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Record a payment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select a completed PROCY sale from the current payment queue.
                  </p>
                </div>
              </div>
              {awaitingPayment.length === 0 ? (
                <div className="mt-7 rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground">
                  No Sold orders are waiting for payment recording.
                </div>
              ) : (
                <form className="mt-7 space-y-5" onSubmit={recordPayment}>
                  <div className="space-y-2">
                    <Label htmlFor="transaction">Sold order</Label>
                    <AppSelect
                      id="transaction"
                      value={selectedOrderId}
                      onValueChange={(value) => {
                        setSelectedOrderId(value);
                        setMethod("");
                      }}
                      placeholder="Select a Sold order"
                      options={awaitingPayment.map((order) => ({
                        value: order.id,
                        label: `${order.id} — ${order.buyer}`,
                        description: order.total,
                      }))}
                    />
                  </div>
                  {selectedOrder && (
                    <div className="rounded-2xl bg-muted p-4 text-sm">
                      <p className="font-medium">{selectedOrder.product}</p>
                      <p className="mt-1 text-muted-foreground">
                        {selectedOrder.quantity} · {selectedOrder.classification} ·{" "}
                        {selectedOrder.total}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="method">Payment method</Label>
                    <AppSelect
                      id="method"
                      value={method}
                      onValueChange={setMethod}
                      placeholder="Select a method"
                      options={[
                        ...(selectedOrder?.fulfillmentMethod === "delivery"
                          ? [{ value: "cash_on_delivery", label: "Cash on Delivery (COD)" }]
                          : []),
                        { value: "cash", label: "Cash" },
                      ]}
                    />
                  </div>
                  <Button type="submit" className="rounded-full">
                    Record payment as Paid
                  </Button>
                </form>
              )}
            </section>
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-6 py-5">
                <h2 className="text-lg font-semibold">Recorded payments</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Payment records linked to completed PROCY orders.
                </p>
              </div>
              <div className="divide-y divide-border">
                {recordedPayments.map((order) => (
                  <div
                    key={order.id}
                    className="grid grid-cols-1 gap-3 px-6 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {order.paymentId ?? "Payment recorded"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {order.id} · {order.buyer} · {paymentMethodLabel(order.paymentMethod)}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="whitespace-nowrap font-medium">{order.total}</p>
                      <p className="text-xs font-medium text-primary">Paid {order.paidAt ?? ""}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit whitespace-nowrap rounded-full sm:justify-self-end"
                      onClick={() => printReceipt(order)}
                    >
                      <Printer className="size-4" /> Print receipt
                    </Button>
                  </div>
                ))}
                {recordedPayments.length === 0 && (
                  <p className="px-6 py-8 text-sm text-muted-foreground">
                    No payments recorded yet.
                  </p>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
      {receiptOrder && <AccountingPaymentReceipt order={receiptOrder} />}
      <style>{`@media print {
        .accounting-payment-receipt {
          display: block !important;
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          min-height: 100vh !important;
          z-index: 9999 !important;
        }
      }`}</style>
    </AccountingLayout>
  );
}
