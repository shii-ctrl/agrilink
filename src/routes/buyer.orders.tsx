import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PackageCheck, Printer, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { BuyerLayout, BuyerPageHeader } from "@/components/workspaces/buyer-layout";
import { OrderDetails } from "@/features/marketplace/components/order-details";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import type { DemoOrder } from "@/lib/demo/demo-orders";
import {
  getBuyerOrders,
  getOrderDetails,
  releaseDatabaseOrder,
  rebuildBuyerCartFromOrder,
} from "@/services/marketplace/marketplace-server-functions";
export const Route = createFileRoute("/buyer/orders")({ component: BuyerOrdersPage });
const emptyOrders: DemoOrder[] = [];

function paymentMethodLabel(method?: string) {
  if (method === "cash_on_delivery") return "Cash on Delivery (COD)";
  if (method === "cash") return "Cash";
  return "To be recorded by Accounting";
}

function BuyerOrderReceipt({ order }: { order: DemoOrder }) {
  const items = order.items?.length
    ? order.items
    : [
        {
          listingId: order.id,
          name: order.product,
          classification: order.classification,
          quantityKg: Number.parseFloat(order.quantity) || 0,
          pricePerKg: 0,
        },
      ];
  const totalQuantity = items.reduce((total, item) => total + item.quantityKg, 0);
  const fulfillment = order.pickupNote?.startsWith("Delivery:") ? "Delivery" : "Pickup";

  return (
    <section className="buyer-order-receipt hidden print:block print:bg-white print:p-8 print:text-black">
      <div className="mx-auto max-w-2xl border border-slate-300 bg-white p-8 text-slate-950">
        <div className="flex items-start justify-between gap-6 border-b border-slate-300 pb-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">AgriLink</p>
            <h1 className="mt-2 text-3xl font-bold">Order receipt</h1>
            <p className="mt-1 text-sm text-slate-600">PROCY marketplace fulfillment record</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{order.id}</p>
            <p className="mt-1 text-slate-600">Completed {order.soldAt ?? order.date}</p>
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
            <dt className="font-medium text-slate-500">Payment</dt>
            <dd className="mt-1 font-semibold">{order.paymentStatus}</dd>
            <dd className="text-slate-700">{paymentMethodLabel(order.paymentMethod)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Payment reference</dt>
            <dd className="mt-1 font-semibold">{order.paymentId ?? "Pending payment record"}</dd>
          </div>
        </dl>

        <div className="mt-6 overflow-hidden border border-slate-300">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <span>Product</span>
            <span>Quantity</span>
            <span>Price</span>
          </div>
          {items.map((item) => (
            <div key={item.listingId} className="grid grid-cols-[1fr_auto_auto] gap-4 border-t border-slate-200 px-4 py-3 text-sm">
              <span>
                <span className="block font-semibold">{item.name}</span>
                <span className="text-slate-600">{item.classification}</span>
              </span>
              <span>{item.quantityKg} kg</span>
              <span>{item.pricePerKg > 0 ? `₱${item.pricePerKg.toFixed(2)} / kg` : "Included"}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t-2 border-slate-400 px-4 py-4">
            <span className="font-semibold">Total · {totalQuantity} kg</span>
            <span className="text-xl font-bold">{order.total}</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Keep this receipt as confirmation of your completed PROCY order.
        </p>
      </div>
    </section>
  );
}

function BuyerOrdersPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<DemoOrder | null>(null);
  const [query, setQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const request = useCallback(async () => {
    const databaseOrders = await getBuyerOrders();
    return databaseOrders.map((order) => ({
      id: order.orderNumber,
      buyer: "You",
      farmer: "PROCY farmer members",
      product: "Order details",
      classification: "Mixed",
      quantity: "See pickup details",
      total: new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
        order.totalAmount,
      ),
      status:
        `${order.status.charAt(0).toUpperCase()}${order.status.slice(1)}` as DemoOrder["status"],
      paymentStatus: order.paymentStatus as DemoOrder["paymentStatus"],
      date: order.createdAt.toLocaleDateString("en-PH"),
      createdAt: order.createdAt.toISOString(),
      contact: order.contact,
      pickupNote: order.pickupNote,
      items: [],
      stockReserved: order.status === "pending" || order.status === "confirmed",
    }));
  }, []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const orders = data ?? emptyOrders;
  const visibleOrders = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return orders.filter(
      (order) =>
        (!search ||
          `${order.id} ${order.product} ${order.status}`.toLocaleLowerCase().includes(search)) &&
        (!orderStatus || order.status === orderStatus) &&
        (!paymentStatus || order.paymentStatus === paymentStatus) &&
        (!orderDate || order.createdAt?.slice(0, 10) === orderDate),
    );
  }, [orderDate, orderStatus, orders, paymentStatus, query]);
  const hasFilters = query || orderStatus || paymentStatus || orderDate;
  const ordersPage = usePagination(visibleOrders);
  const cancelOrder = async (order: DemoOrder) => {
    if (
      !(await requestConfirmation({
        title: "Cancel this order?",
        description: `${order.id} will be cancelled and its reserved stock will return to the marketplace.`,
        confirmLabel: "Cancel order",
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await releaseDatabaseOrder({ data: { orderNumber: order.id, outcome: "cancelled" } });
      await reload();
      setSelectedId(null);
      toast.success("Order cancelled", { description: "Reserved stock has been returned." });
    } catch (error) {
      toast.error("Order could not be cancelled", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };
  const openDetails = async (orderNumber: string) => {
    try {
      const detail = await getOrderDetails({ data: { orderNumber } });
      setSelectedOrder({
        id: detail.orderNumber,
        buyer: detail.buyer,
        farmer: "PROCY farmer members",
        product: detail.items[0]?.name ?? "Order details",
        classification: detail.items[0]?.classification ?? "Mixed",
        quantity: `${detail.items.reduce((total, item) => total + item.quantityKg, 0)} kg`,
        total: new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
          detail.totalAmount,
        ),
        status:
          `${detail.status.charAt(0).toUpperCase()}${detail.status.slice(1)}` as DemoOrder["status"],
        paymentStatus: detail.payment ? "Paid" : "Unpaid",
        date: new Date(detail.createdAt).toLocaleDateString("en-PH"),
        ...(detail.confirmedAt
          ? { confirmedAt: new Date(detail.confirmedAt).toLocaleDateString("en-PH") }
          : {}),
        ...(detail.soldAt ? { soldAt: new Date(detail.soldAt).toLocaleDateString("en-PH") } : {}),
        ...(detail.payment?.paymentNumber ? { paymentId: detail.payment.paymentNumber } : {}),
        ...(detail.payment?.method ? { paymentMethod: detail.payment.method } : {}),
        ...(detail.payment?.paidAt
          ? { paidAt: new Date(detail.payment.paidAt).toLocaleDateString("en-PH") }
          : {}),
        contact: detail.contact,
        pickupNote: detail.pickupNote,
        items: detail.items,
        history: detail.history.map((entry) => ({
          status: `${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}`,
          note: entry.note,
          changedAt: new Date(entry.changedAt).toLocaleString("en-PH"),
        })),
        stockReserved: detail.status === "pending" || detail.status === "confirmed",
      });
      setSelectedId(orderNumber);
    } catch (error) {
      toast.error("Could not load order details", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };
  const buyAgain = async (order: DemoOrder) => {
    try {
      const rebuilt = await rebuildBuyerCartFromOrder({ data: { orderNumber: order.id } });
      toast.success("Order added to cart", {
        description: `${rebuilt.quantityKg} kg is ready for your next checkout.`,
      });
      navigate({ to: "/buyer/cart" });
    } catch (error) {
      toast.error("Could not rebuild this order", {
        description:
          error instanceof Error
            ? error.message
            : "The available stock may have changed. Please try again.",
      });
    }
  };
  return (
    <BuyerLayout>
      <div className="buyer-order-screen print:hidden">
        {confirmationDialog}
        <BuyerPageHeader
          title="My Orders"
          description="Track buyer orders submitted to PROCY. Payment status is recorded separately by Accounting."
        />
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="order history"
        />
        {!loading && !error && (
          <>
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex items-start gap-3 border-b border-border px-6 py-5">
                <PackageCheck className="mt-0.5 size-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Order history</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Orders saved in AgriLink.</p>
                </div>
              </div>
              <div className="grid gap-3 border-b border-border p-5 md:grid-cols-3">
                <Input
                  aria-label="Search my orders"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search order, product, or status"
                />
                <AppSelect
                  ariaLabel="Filter my orders by status"
                  value={orderStatus}
                  onValueChange={setOrderStatus}
                  options={[
                    { value: "", label: "All order states" },
                    ...["Pending", "Confirmed", "Sold", "Cancelled", "Rejected"].map((value) => ({
                      value,
                      label: value,
                    })),
                  ]}
                />
                <AppSelect
                  ariaLabel="Filter my orders by payment status"
                  value={paymentStatus}
                  onValueChange={setPaymentStatus}
                  options={[
                    { value: "", label: "All payment states" },
                    { value: "Paid", label: "Paid" },
                    { value: "Unpaid", label: "Unpaid" },
                  ]}
                />
                <DatePicker
                  ariaLabel="Filter my orders by date"
                  value={orderDate}
                  onValueChange={setOrderDate}
                />
                {hasFilters && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setOrderStatus("");
                      setPaymentStatus("");
                      setOrderDate("");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 font-medium">Order ID</th>
                      <th className="px-6 py-4 font-medium">Items</th>
                      <th className="px-6 py-4 font-medium">Total</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Payment</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersPage.pageItems.map((order) => (
                      <tr key={order.id} className="border-b border-border last:border-0">
                        <td className="px-6 py-4 font-medium">{order.id}</td>
                        <td className="px-6 py-4">
                          {order.quantity} {order.product} ({order.classification})
                        </td>
                        <td className="px-6 py-4">{order.total}</td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              order.paymentStatus === "Paid"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {order.paymentStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{order.date}</td>
                        <td className="px-6 py-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => void openDetails(order.id)}
                          >
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!visibleOrders.length && (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                          {orders.length
                            ? "No orders match these filters."
                            : "No orders have been saved yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls {...ordersPage} itemLabel="orders" />
            </section>
            {selectedId &&
              (() => {
                const order = selectedOrder ?? orders.find((item) => item.id === selectedId);
                return order ? (
                  <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-card">
                    <div className="flex flex-wrap justify-end gap-2">
                      {order.status === "Pending" && (
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => cancelOrder(order)}
                        >
                          Cancel order
                        </Button>
                      )}
                      {order.status === "Confirmed" && (
                        <p className="self-center text-sm text-muted-foreground">
                          This order is confirmed. Contact PROCY if you need it cancelled.
                        </p>
                      )}
                      {order.status === "Sold" && (
                        <Button className="rounded-full" onClick={() => buyAgain(order)}>
                          <RotateCcw className="size-4" /> Buy again
                        </Button>
                      )}
                      {order.status === "Sold" && (
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => window.print()}
                        >
                          <Printer className="size-4" /> Print receipt
                        </Button>
                      )}
                    </div>
                    {order.status === "Sold" && (
                      <p className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                        Your receipt is available because this order has been completed through pickup or delivery.
                      </p>
                    )}
                    <div className="mt-2">
                      <OrderDetails order={order} />
                    </div>
                  </section>
                ) : null;
              })()}
          </>
        )}
        </main>
      </div>
      {selectedOrder?.status === "Sold" && <BuyerOrderReceipt order={selectedOrder} />}
      <style>{`@media print {
        div:has(> [data-sidebar="sidebar"]), div:has(> div > [data-sidebar="sidebar"]) { display: none !important; }
        .buyer-order-receipt { display: block !important; }
      }`}</style>
    </BuyerLayout>
  );
}
