import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PackageCheck, RotateCcw } from "lucide-react";
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
        date: detail.createdAt,
        createdAt: detail.createdAt,
        ...(detail.confirmedAt ? { confirmedAt: detail.confirmedAt } : {}),
        ...(detail.soldAt ? { soldAt: detail.soldAt } : {}),
        ...(detail.payment?.paymentNumber ? { paymentId: detail.payment.paymentNumber } : {}),
        ...(detail.payment?.method ? { paymentMethod: detail.payment.method } : {}),
        ...(detail.payment?.paidAt ? { paidAt: detail.payment.paidAt } : {}),
        contact: detail.contact,
        pickupNote: detail.pickupNote,
        items: detail.items,
        history: detail.history.map((entry) => ({
          status: `${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}`,
          note: entry.note,
          changedAt: entry.changedAt,
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
                      </div>
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
    </BuyerLayout>
  );
}
