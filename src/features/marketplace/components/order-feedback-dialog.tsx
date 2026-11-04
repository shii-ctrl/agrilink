import { LoaderCircle, MessageSquareText, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyOrderFeedback,
  submitOrderFeedback,
} from "@/services/marketplace/order-feedback-server-functions";

type FeedbackData = Awaited<ReturnType<typeof getMyOrderFeedback>>;

function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
            onClick={() => onChange(rating)}
            className="grid size-10 place-items-center rounded-full text-amber-500 transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Star
              className={`size-6 ${rating <= value ? "fill-current" : "text-muted-foreground/40"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function OrderFeedbackDialog({
  open,
  onOpenChange,
  orderNumber,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string | null;
  onSaved?: () => void | Promise<void>;
}) {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serviceRating, setServiceRating] = useState(0);
  const [riderRating, setRiderRating] = useState(0);
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open || !orderNumber) return;
    let active = true;
    setLoading(true);
    setData(null);
    void getMyOrderFeedback({ data: { orderNumber } })
      .then((result) => {
        if (!active) return;
        setData(result);
        setServiceRating(result.feedback?.serviceRating ?? 0);
        setRiderRating(result.feedback?.riderRating ?? 0);
        setComment(result.feedback?.comment ?? "");
        setItemRatings(
          Object.fromEntries(result.items.map((item) => [item.orderItemId, item.rating ?? 0])),
        );
      })
      .catch((error) => {
        if (!active) return;
        toast.error("Could not load order feedback", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
        onOpenChangeRef.current(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, orderNumber]);

  const everyProductRated = Boolean(
    data?.items.length && data.items.every((item) => (itemRatings[item.orderItemId] ?? 0) > 0),
  );
  const riderRequired = data?.fulfillmentMethod === "delivery";
  const canSave =
    Boolean(data?.eligible) &&
    everyProductRated &&
    serviceRating > 0 &&
    (!riderRequired || riderRating > 0) &&
    !saving;

  async function saveFeedback() {
    if (!data || !orderNumber || !canSave) return;
    setSaving(true);
    try {
      await submitOrderFeedback({
        data: {
          orderNumber,
          serviceRating,
          riderRating: riderRequired ? riderRating : null,
          comment: comment.trim() || null,
          itemRatings: data.items.map((item) => ({
            orderItemId: item.orderItemId,
            rating: itemRatings[item.orderItemId]!,
          })),
        },
      });
      toast.success(data.feedback ? "Feedback updated" : "Thank you for your feedback", {
        description: "Your ratings were saved for PROCY review.",
      });
      await onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error("Feedback could not be saved", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <div className="pr-8">
          <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <MessageSquareText className="size-5" />
          </span>
          <DialogTitle>{data?.feedback ? "Update your feedback" : "Rate your order"}</DialogTitle>
          <DialogDescription className="mt-2">
            Rate the products and service for {orderNumber}. Your feedback helps PROCY improve.
          </DialogDescription>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin text-primary" /> Loading feedback…
          </div>
        ) : data ? (
          <div className="mt-5 space-y-5">
            {!data.eligible ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                This order can be rated after it has been picked up or delivered.
              </div>
            ) : null}

            <section className="rounded-2xl border border-border bg-muted/25 p-4">
              <h3 className="font-semibold">Product quality</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Rate each classified product you received.
              </p>
              <div className="mt-3 divide-y divide-border">
                {data.items.map((item) => (
                  <div key={item.orderItemId} className="py-3 first:pt-0 last:pb-0">
                    <StarRating
                      label={`${item.name} · ${item.classification}`}
                      value={itemRatings[item.orderItemId] ?? 0}
                      onChange={(value) =>
                        setItemRatings((current) => ({ ...current, [item.orderItemId]: value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border p-4">
              <StarRating label="PROCY service" value={serviceRating} onChange={setServiceRating} />
              {riderRequired ? (
                <StarRating label="Rider service" value={riderRating} onChange={setRiderRating} />
              ) : null}
            </section>

            <label className="grid gap-2 text-sm font-medium">
              Additional feedback{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={1_500}
                rows={4}
                placeholder="Tell PROCY what went well or what could be improved."
              />
              <span className="text-right text-xs font-normal text-muted-foreground">
                {comment.length}/1500
              </span>
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={!canSave} onClick={() => void saveFeedback()}>
                {saving ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Star className="size-4" />
                )}
                {saving ? "Saving…" : data.feedback ? "Update feedback" : "Submit feedback"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
