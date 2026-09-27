import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PackageCheck, Printer, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BuyerLayout, BuyerPageHeader } from "@/components/buyer-layout";
import { OrderDetails } from "@/components/order-details";
import { Button } from "@/components/ui/button";
import type { DemoOrder } from "@/lib/demo-orders";
import {
  addBuyerCartItem,
  getBuyerOrders,
  getOrderDetails,
  getMarketplaceListing,
  releaseDatabaseOrder,
} from "@/lib/marketplace-server-functions";
export const Route = createFileRoute("/buyer/orders")({ component: BuyerOrdersPage });
function BuyerOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<DemoOrder | null>(null);
  const loadOrders = async () => {
    const databaseOrders = await getBuyerOrders();
    setOrders(
      databaseOrders.map((order) => ({
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
        contact: order.contact,
        pickupNote: order.pickupNote,
        items: [],
        stockReserved: order.status === "pending" || order.status === "confirmed",
      })),
    );
  };
  useEffect(() => {
    void loadOrders().catch(() => toast.error("Could not load your MySQL order history."));
  }, []);
  const cancelOrder = async (order: DemoOrder) => {
    if (!window.confirm(`Cancel ${order.id}? The reserved stock will return to the marketplace.`)) {
      return;
    }
    try {
      await releaseDatabaseOrder({ data: { orderNumber: order.id, outcome: "cancelled" } });
      await loadOrders();
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
      const products = await Promise.all(
        (order.items ?? []).map((item) =>
          getMarketplaceListing({ data: { listingId: item.listingId } }),
        ),
      );
      const availableItems = products.flatMap((product, index) => {
        const item = order.items?.[index];
        return product && item ? [{ product, item }] : [];
      });
      if (!availableItems.length) {
        toast("Items are currently unavailable", {
          description:
            "This completed order cannot be rebuilt because its classified stock is unavailable.",
        });
        return;
      }
      let added = 0;
      for (const { product, item } of availableItems) {
        await addBuyerCartItem({
          data: { listingId: product.id, quantityKg: item.quantityKg },
        });
        added += item.quantityKg;
      }
      toast.success("Order added to cart", {
        description: `${added} kg is ready for your next checkout.`,
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
      <BuyerPageHeader
        title="My Orders"
        description="Track buyer orders submitted to PROCY. Payment status is recorded separately by Accounting."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="flex items-start gap-3 border-b border-border px-6 py-5">
            <PackageCheck className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Order history</h2>
              <p className="mt-1 text-sm text-muted-foreground">Orders saved in AgriLink.</p>
            </div>
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
                {orders.map((order) => (
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
              </tbody>
            </table>
          </div>
        </section>
        {selectedId &&
          (() => {
            const order = selectedOrder ?? orders.find((item) => item.id === selectedId);
            return order ? (
              <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex flex-wrap justify-end gap-2">
                  {(order.status === "Pending" || order.status === "Confirmed") && (
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => cancelOrder(order)}
                    >
                      Cancel order
                    </Button>
                  )}
                  {order.status === "Sold" && (
                    <Button className="rounded-full" onClick={() => buyAgain(order)}>
                      <RotateCcw className="size-4" /> Buy again
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
                    <Printer className="size-4" /> Print order
                  </Button>
                </div>
                <div className="mt-2">
                  <OrderDetails order={order} />
                </div>
              </section>
            ) : null;
          })()}
      </main>
    </BuyerLayout>
  );
}
