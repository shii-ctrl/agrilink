import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle, PackageCheck, RotateCcw, Star } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/ui/toast";
import { BuyerLayout, BuyerPageHeader } from "@/components/workspaces/buyer-layout";
import { OrderDetails } from "@/features/marketplace/components/order-details";
import { OrderFeedbackDialog } from "@/features/marketplace/components/order-feedback-dialog";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { EmptyState } from "@/components/data/empty-state";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { ResponsiveFilterPanel } from "@/components/data/responsive-filter-panel";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import type { OrderRecord } from "@/features/marketplace/order-records";
import { formatSellingQuantity } from "@/features/marketplace/selling-units";
import {
  getBuyerOrders,
  getOrderDetails,
  releaseDatabaseOrder,
  rebuildBuyerCartFromOrder,
} from "@/services/marketplace/marketplace-server-functions";
export const Route = createFileRoute("/buyer/orders")({ component: BuyerOrdersPage });
const emptyOrders: OrderRecord[] = [];

function BuyerOrdersPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [feedbackOrderNumber, setFeedbackOrderNumber] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const detailsRequestRef = useRef<string | null>(null);
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
        `${order.status.charAt(0).toUpperCase()}${order.status.slice(1)}` as OrderRecord["status"],
      paymentStatus: order.paymentStatus as OrderRecord["paymentStatus"],
      date: order.createdAt.toLocaleDateString("en-PH"),
      createdAt: order.createdAt.toISOString(),
      contact: order.contact,
      pickupNote: order.pickupNote,
      fulfillmentMethod: order.fulfillmentMethod,
      fulfillmentStatus: order.fulfillmentStatus,
      recipientName: order.recipientName,
      deliveryAddress: order.deliveryAddress,
      preferredSchedule: order.preferredSchedule,
      deliveryInstructions: order.deliveryInstructions,
      ...(order.fulfilledAt ? { fulfilledAt: order.fulfilledAt.toISOString() } : {}),
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
  const cancelOrder = async (order: OrderRecord) => {
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
    } catch {
      toast.error("Order could not be cancelled", {
        description: "Please try again. If the problem continues, contact PROCY support.",
      });
    }
  };
  const loadOrderDetails = useCallback(async (orderNumber: string, background = false) => {
    if (detailsRequestRef.current) return;
    detailsRequestRef.current = orderNumber;
    if (!background) {
      setSelectedId(orderNumber);
      setSelectedOrder(null);
      setDetailsLoading(true);
    }
    try {
      const detail = await getOrderDetails({ data: { orderNumber } });
      setSelectedOrder({
        id: detail.orderNumber,
        buyer: detail.buyer,
        farmer: "PROCY farmer members",
        product: detail.items[0]?.name ?? "Order details",
        classification: detail.items[0]?.classification ?? "Mixed",
        quantity:
          detail.items.length === 1
            ? formatSellingQuantity(
                detail.items[0]!.quantityKg,
                detail.items[0]!.sellingUnit ?? "kg",
              )
            : `${detail.items.length} classified items`,
        total: new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
          detail.totalAmount,
        ),
        status:
          `${detail.status.charAt(0).toUpperCase()}${detail.status.slice(1)}` as OrderRecord["status"],
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
        fulfillmentMethod: detail.fulfillmentMethod,
        fulfillmentStatus: detail.fulfillmentStatus,
        recipientName: detail.recipientName,
        deliveryAddress: detail.deliveryAddress,
        preferredSchedule: detail.preferredSchedule,
        deliveryInstructions: detail.deliveryInstructions,
        assignedRiderId: detail.assignedRiderId,
        assignedRiderName: detail.assignedRiderName,
        deliveryOtpCode: detail.deliveryOtpCode,
        deliveryProof: detail.deliveryProof,
        ...(detail.fulfilledAt ? { fulfilledAt: detail.fulfilledAt } : {}),
        items: detail.items,
        history: detail.history.map((entry) => ({
          status: `${entry.status.charAt(0).toUpperCase()}${entry.status.slice(1)}`,
          note: entry.note,
          changedAt: entry.changedAt,
        })),
        stockReserved: detail.status === "pending" || detail.status === "confirmed",
      });
    } catch {
      if (!background) {
        setSelectedId(null);
        toast.error("Could not load order details", {
          id: "buyer-order-details-error",
          description: "Please try again. If the problem continues, contact PROCY support.",
        });
      }
    } finally {
      detailsRequestRef.current = null;
      if (!background) setDetailsLoading(false);
    }
  }, []);
  const openDetails = (orderNumber: string) => loadOrderDetails(orderNumber);
  useAutoRefresh(() => {
    if (!selectedId) return;
    return loadOrderDetails(selectedId, true);
  }, 3_000);
  const buyAgain = async (order: OrderRecord) => {
    try {
      await rebuildBuyerCartFromOrder({ data: { orderNumber: order.id } });
      toast.success("Order added to cart", {
        description: "The available quantities are reserved for your next checkout.",
      });
      navigate({ to: "/buyer/cart" });
    } catch {
      toast.error("Could not rebuild this order", {
        description: "The available stock may have changed. Please try again.",
      });
    }
  };
  return (
    <BuyerLayout>
      <div className="buyer-order-screen print:hidden">
        {confirmationDialog}
        <BuyerPageHeader
          title="My Orders"
          description="View your orders, payment status, and pickup or delivery updates."
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
                    <p className="mt-1 text-sm text-muted-foreground">Your recent orders.</p>
                  </div>
                </div>
                <ResponsiveFilterPanel
                  activeCount={
                    Number(Boolean(query)) +
                    Number(Boolean(orderStatus)) +
                    Number(Boolean(paymentStatus)) +
                    Number(Boolean(orderDate))
                  }
                  contentClassName="md:grid-cols-3"
                >
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
                </ResponsiveFilterPanel>
                <div className="grid gap-3 p-4 md:hidden">
                  {ordersPage.pageItems.map((order) => (
                    <article
                      key={order.id}
                      className="rounded-2xl border border-border bg-background p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold uppercase tracking-wide text-primary">
                            {order.id}
                          </p>
                          <h3 className="mt-1 font-semibold">{order.product}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {order.quantity} · {order.classification}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusClass(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="mt-0.5 font-semibold">{order.total}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Payment</p>
                          <p
                            className={`mt-0.5 font-semibold ${order.paymentStatus === "Paid" ? "text-primary" : "text-muted-foreground"}`}
                          >
                            {order.paymentStatus}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Order date</p>
                          <p className="mt-0.5">{order.date}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="mt-4 w-full"
                        disabled={detailsLoading}
                        onClick={() => void openDetails(order.id)}
                      >
                        View order details
                      </Button>
                    </article>
                  ))}
                  {!visibleOrders.length ? (
                    <EmptyState
                      compact
                      icon={PackageCheck}
                      title={orders.length ? "No matching orders" : "No orders yet"}
                      description={
                        orders.length
                          ? "Try clearing or changing your filters."
                          : "Your PROCY marketplace orders will appear here."
                      }
                    />
                  ) : null}
                </div>
                <div className="hidden overflow-x-auto md:block">
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
                              disabled={detailsLoading}
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
            </>
          )}
        </main>
        <Dialog
          open={Boolean(selectedId)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedId(null);
              setSelectedOrder(null);
            }
          }}
        >
          <DialogContent className="h-[100dvh] max-h-[100dvh] w-full max-w-none overflow-hidden border-0 p-0 sm:h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-6xl sm:rounded-3xl sm:border">
            <DialogTitle className="sr-only">Order details</DialogTitle>
            <DialogDescription className="sr-only">
              Review the selected order without leaving the order history.
            </DialogDescription>
            {detailsLoading ? (
              <div
                className="flex h-full min-h-0 flex-col items-center justify-center gap-3 overflow-y-auto p-4 text-center sm:p-6"
                role="status"
                aria-live="polite"
              >
                <LoaderCircle className="size-8 animate-spin text-primary" />
                <div>
                  <p className="font-semibold">Loading order details</p>
                  <p className="mt-1 text-sm text-muted-foreground">Please wait a moment.</p>
                </div>
              </div>
            ) : selectedOrder ? (
              <div className="h-full min-h-0 overflow-y-auto p-4 pt-14 sm:p-6 sm:pt-10">
                <div className="mb-4 flex flex-wrap justify-end gap-2 pr-12">
                  {selectedOrder.status === "Pending" && (
                    <Button
                      variant="destructive"
                      className="rounded-full"
                      onClick={() => cancelOrder(selectedOrder)}
                    >
                      Cancel order
                    </Button>
                  )}
                  {selectedOrder.status === "Confirmed" && (
                    <p className="self-center text-sm text-muted-foreground">
                      This order is confirmed. Contact PROCY if you need it cancelled.
                    </p>
                  )}
                  {selectedOrder.status === "Sold" && (
                    <Button className="rounded-full" onClick={() => buyAgain(selectedOrder)}>
                      <RotateCcw className="size-4" /> Buy again
                    </Button>
                  )}
                  {selectedOrder.status === "Sold" &&
                  ["picked_up", "delivered"].includes(selectedOrder.fulfillmentStatus ?? "") ? (
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setFeedbackOrderNumber(selectedOrder.id)}
                    >
                      <Star className="size-4" /> Rate order
                    </Button>
                  ) : null}
                  {selectedOrder.fulfillmentStatus === "delivered" &&
                  selectedOrder.fulfilledAt &&
                  Date.now() - new Date(selectedOrder.fulfilledAt).getTime() <=
                    24 * 60 * 60 * 1000 ? (
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => navigate({ to: "/buyer/issues" })}
                    >
                      <CircleAlert className="size-4" /> Report delivery issue
                    </Button>
                  ) : null}
                </div>
                <OrderDetails order={selectedOrder} canMessageRider />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
        <OrderFeedbackDialog
          open={Boolean(feedbackOrderNumber)}
          onOpenChange={(open) => {
            if (!open) setFeedbackOrderNumber(null);
          }}
          orderNumber={feedbackOrderNumber}
          onSaved={async () => {
            await reload();
          }}
        />
      </div>
    </BuyerLayout>
  );
}

function orderStatusClass(status: string) {
  if (["Sold"].includes(status)) return "bg-emerald-100 text-emerald-800";
  if (["Confirmed"].includes(status)) return "bg-blue-100 text-blue-800";
  if (["Cancelled", "Rejected"].includes(status)) return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}
