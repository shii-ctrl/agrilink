import { CalendarClock, ImageIcon, MessageCircle, PackageX, ReceiptText } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  disputeCategoryLabels,
  disputeResolutionLabels,
  disputeStatusLabels,
  type DeliveryDispute,
} from "@/features/marketplace/delivery-disputes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

export function DeliveryDisputeCard({
  dispute,
  response,
  onResponseChange,
  onRespond,
  responding = false,
  actions,
}: {
  dispute: DeliveryDispute;
  response?: string;
  onResponseChange?: (value: string) => void;
  onRespond?: () => void;
  responding?: boolean;
  actions?: ReactNode;
}) {
  const closed = ["rejected", "resolved"].includes(dispute.status);
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {dispute.disputeNumber}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{dispute.orderNumber}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Buyer: {dispute.buyerName}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {disputeStatusLabels[dispute.status] ?? dispute.status}
        </span>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <PackageX className="size-4 text-primary" /> Issue
            </p>
            <p className="mt-2 font-medium">
              {disputeCategoryLabels[dispute.category] ?? dispute.category}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {dispute.description}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4 text-sm">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarClock className="size-4 text-primary" /> Case details
            </p>
            <p className="mt-2">Opened {formatDate(dispute.openedAt)}</p>
            <p className="mt-1 text-muted-foreground">
              Order total: ₱{dispute.totalAmount.toFixed(2)}
            </p>
            {dispute.resolution ? (
              <p className="mt-2 font-medium text-primary">
                {disputeResolutionLabels[dispute.resolution] ?? dispute.resolution}
                {dispute.refundAmount ? ` · ₱${dispute.refundAmount.toFixed(2)}` : ""}
              </p>
            ) : null}
            {dispute.resolutionNote ? (
              <p className="mt-1 text-muted-foreground">{dispute.resolutionNote}</p>
            ) : null}
          </div>
        </div>
        {dispute.attachmentUrl ? (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="size-4 text-primary" /> Buyer attachment
            </p>
            <img
              src={dispute.attachmentUrl}
              alt={`Attachment for ${dispute.disputeNumber}`}
              className="max-h-72 w-full rounded-2xl border border-border object-contain"
            />
          </div>
        ) : null}
        <div>
          <h4 className="flex items-center gap-2 font-semibold">
            <MessageCircle className="size-4 text-primary" /> Conversation
          </h4>
          {dispute.responses.length ? (
            <div className="mt-3 space-y-2">
              {dispute.responses.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-semibold">
                      {item.authorName} · {item.authorRole}
                    </p>
                    <time className="text-xs text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No responses yet.</p>
          )}
        </div>
        {onRespond && onResponseChange && !closed ? (
          <div className="space-y-2 rounded-2xl border border-border p-4">
            <label className="text-sm font-semibold" htmlFor={`response-${dispute.id}`}>
              Add a response
            </label>
            <Textarea
              id={`response-${dispute.id}`}
              value={response ?? ""}
              onChange={(event) => onResponseChange(event.target.value)}
              placeholder="Share useful information about this issue"
              maxLength={2_000}
            />
            <Button
              type="button"
              className="rounded-full"
              disabled={responding || (response?.trim().length ?? 0) < 2}
              onClick={onRespond}
            >
              <MessageCircle className="size-4" /> {responding ? "Sending…" : "Send response"}
            </Button>
          </div>
        ) : null}
        {dispute.events.length ? (
          <details className="rounded-2xl border border-border p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              <span className="inline-flex items-center gap-2">
                <ReceiptText className="size-4 text-primary" /> Case activity
              </span>
            </summary>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              {dispute.events.map((event) => (
                <li key={event.id}>
                  <span className="font-medium text-foreground">
                    {event.event.replaceAll("_", " ")}
                  </span>{" "}
                  · {formatDate(event.createdAt)}
                  {event.note ? ` · ${event.note}` : ""}
                </li>
              ))}
            </ol>
          </details>
        ) : null}
        {actions}
      </div>
    </article>
  );
}
