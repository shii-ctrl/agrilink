import { createFileRoute } from "@tanstack/react-router";
import { CircleDollarSign, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountingLayout, AccountingPageHeader } from "@/components/accounting-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type DemoOrder } from "@/lib/demo-orders";
import { getDatabaseOrders, recordDatabasePayment } from "@/lib/marketplace-server-functions";

export const Route = createFileRoute("/accounting/payments")({ component: AccountingPaymentsPage });

function AccountingPaymentsPage() {
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [method, setMethod] = useState("");

  useEffect(() => {
    void getDatabaseOrders()
      .then(setOrders)
      .catch(() => toast.error("Could not load payments."));
  }, []);

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

    const databaseMethod =
      method === "Cash"
        ? "cash"
        : method === "Bank Transfer"
          ? "bank_transfer"
          : "manual_reference";
    try {
      const result = await recordDatabasePayment({
        data: {
          orderNumber: selectedOrder.id,
          method: databaseMethod,
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

  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Record Payment"
        description="Record payment after a PROCY order is marked Sold. This page records payment information and does not process online payments."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-6 flex gap-3 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <Clock3 className="mt-0.5 size-5 shrink-0" />
          <p>
            <span className="font-semibold">Payment queue:</span> only Sold PROCY orders are ready
            for payment recording. Buyer payment status updates immediately; Farmer stock status
            updates when sales are fulfilled.
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
                  <select
                    id="transaction"
                    value={selectedOrderId}
                    onChange={(event) => setSelectedOrderId(event.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="" disabled>
                      Select a Sold order
                    </option>
                    {awaitingPayment.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.id} — {order.buyer} · {order.total}
                      </option>
                    ))}
                  </select>
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
                  <select
                    id="method"
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="" disabled>
                      Select a method
                    </option>
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>Other recorded method</option>
                  </select>
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
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <div>
                    <p className="font-medium">{order.paymentId ?? "Payment recorded"}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.id} · {order.buyer} · {order.paymentMethod ?? "Recorded method"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{order.total}</p>
                    <p className="text-xs font-medium text-primary">Paid {order.paidAt ?? ""}</p>
                  </div>
                </div>
              ))}
              {recordedPayments.length === 0 && (
                <p className="px-6 py-8 text-sm text-muted-foreground">No payments recorded yet.</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </AccountingLayout>
  );
}
