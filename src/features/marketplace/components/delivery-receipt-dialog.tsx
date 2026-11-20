import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeliveryReceipt } from "@/features/marketplace/delivery-receipt";
import { peso } from "@/features/marketplace/products";
import { formatSellingQuantity, sellingUnitLabel } from "@/features/marketplace/selling-units";

export function DeliveryReceiptDialog({
  receipt,
  onOpenChange,
}: {
  receipt: DeliveryReceipt | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <Dialog open={Boolean(receipt)} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Delivery receipt preview</DialogTitle>
            <DialogDescription>
              Print this copy and include it with the buyer&apos;s products. Printing does not mark
              the order as paid or delivered.
            </DialogDescription>
          </DialogHeader>
          {receipt && <DeliveryReceiptPaper receipt={receipt} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Print / Save PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {receipt &&
        typeof document !== "undefined" &&
        createPortal(
          <div data-delivery-receipt-print className="hidden">
            <DeliveryReceiptPaper receipt={receipt} />
          </div>,
          document.body,
        )}
    </>
  );
}

export function DeliveryReceiptPaper({ receipt }: { receipt: DeliveryReceipt }) {
  return (
    <div className="delivery-receipt-paper bg-white p-3 text-slate-950 sm:p-6">
      <div className="border-b-2 border-slate-800 pb-4">
        <p className="text-sm font-bold tracking-widest">AGRILINK · PROCY</p>
        <h2 className="mt-2 text-2xl font-bold">Delivery receipt</h2>
        <p className="mt-1 break-all text-sm font-semibold">{receipt.orderNumber}</p>
        <p className="mt-1 text-xs text-slate-600">
          Order date: {formatDate(receipt.orderDate)} · Printed: {formatDate(receipt.printedAt)}
        </p>
      </div>
      <dl className="my-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Deliver to</dt>
          <dd className="mt-1 break-words">{receipt.recipientName}</dd>
          <dd className="break-words">{receipt.contact}</dd>
          <dd className="mt-1 whitespace-pre-wrap break-words">
            {receipt.deliveryAddress || "See delivery arrangements with PROCY."}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Delivery details</dt>
          <dd className="mt-1">Rider: {receipt.riderName || "To be assigned"}</dd>
          {receipt.preferredSchedule && (
            <dd className="mt-1 break-words">Preferred schedule: {receipt.preferredSchedule}</dd>
          )}
          {receipt.deliveryInstructions && (
            <dd className="mt-1 whitespace-pre-wrap break-words">
              Instructions: {receipt.deliveryInstructions}
            </dd>
          )}
        </div>
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-400 bg-slate-100">
              <th className="p-2">Product</th>
              <th className="p-2 text-right">Quantity</th>
              <th className="p-2 text-right">Unit price</th>
              <th className="p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item, index) => (
              <tr key={index} className="border-b border-slate-200 align-top">
                <td className="p-2">
                  <span className="block font-medium">{item.name}</span>
                  <span className="text-xs text-slate-600">{item.classification}</span>
                </td>
                <td className="p-2 text-right">
                  {formatSellingQuantity(item.quantity, item.sellingUnit)}
                </td>
                <td className="p-2 text-right">
                  {peso(item.unitPrice)} / {sellingUnitLabel(item.sellingUnit)}
                </td>
                <td className="p-2 text-right">{peso(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto mt-4 max-w-sm space-y-2 text-sm">
        {receipt.roundingAdjustment !== 0 && (
          <Amount label="Rounding adjustment" value={receipt.roundingAdjustment} />
        )}
        <Amount label="Products subtotal" value={receipt.subtotal} />
        <Amount label="Delivery fee" value={receipt.deliveryFee} />
        <div className="border-t-2 border-slate-500 pt-3 font-bold">
          <Amount label="Order total" value={receipt.total} />
        </div>
      </dl>
      <div className="mt-5 rounded-xl border-2 border-slate-500 p-4 text-sm">
        <p className="font-bold">
          {receipt.paymentStatus === "paid"
            ? "PAID — payment recorded by Accounting"
            : receipt.paymentStatus === "collected"
              ? "COD COLLECTED — awaiting Accounting confirmation"
              : "CASH ON DELIVERY — to pay upon delivery"}
        </p>
        {receipt.paymentReference && (
          <p className="mt-1 break-all">
            Payment reference: {receipt.paymentReference}
            {receipt.paidAt ? ` · ${formatDate(receipt.paidAt)}` : ""}
          </p>
        )}
        {receipt.collectedAt && (
          <p className="mt-1">
            COD collected: {peso(receipt.collectedAmount)} · {formatDate(receipt.collectedAt)}
          </p>
        )}
        <dl className="mt-3 text-lg font-bold">
          <Amount label="Amount to pay" value={receipt.amountDue} />
        </dl>
        <p className="mt-2 text-xs">
          Payment status is shown as of printing. This delivery document does not itself acknowledge
          payment. Accounting issues the payment receipt after payment is recorded.
        </p>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-6 text-xs">
        <div className="border-t border-slate-400 pt-2">Prepared by PROCY</div>
        <div className="border-t border-slate-400 pt-2">Received by / Date</div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        Please check the products and quantities against this delivery receipt.
      </p>
    </div>
  );
}
function Amount({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="shrink-0 text-right">{peso(value)}</dd>
    </div>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}
