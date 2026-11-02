import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, ImagePlus, LoaderCircle, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BuyerLayout, BuyerPageHeader } from "@/components/workspaces/buyer-layout";
import { DeliveryDisputeCard } from "@/features/marketplace/components/delivery-dispute-card";
import { disputeCategoryLabels } from "@/features/marketplace/delivery-disputes";
import { prepareProductImage } from "@/features/marketplace/product-image-upload";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  createDeliveryDispute,
  getMyDeliveryDisputes,
  respondToDeliveryDispute,
} from "@/services/marketplace/delivery-dispute-server-functions";
import { getBuyerOrders } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/buyer/issues")({ component: BuyerDeliveryIssues });

const categories = Object.entries(disputeCategoryLabels).map(([value, label]) => ({
  value,
  label,
}));

function BuyerDeliveryIssues() {
  const request = useCallback(async () => {
    const [disputes, orders] = await Promise.all([getMyDeliveryDisputes(), getBuyerOrders()]);
    return { disputes, orders };
  }, []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const disputes = useMemo(() => data?.disputes ?? [], [data?.disputes]);
  const existingOrderNumbers = new Set(disputes.map((dispute) => dispute.orderNumber));
  const eligibleOrders = (data?.orders ?? []).filter((order) => {
    if (
      order.fulfillmentMethod !== "delivery" ||
      order.fulfillmentStatus !== "delivered" ||
      !order.fulfilledAt ||
      existingOrderNumbers.has(order.orderNumber)
    ) {
      return false;
    }
    return Date.now() - order.fulfilledAt.getTime() <= 24 * 60 * 60 * 1000;
  });
  const [open, setOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [responding, setResponding] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return disputes.filter(
      (dispute) =>
        (!search ||
          `${dispute.disputeNumber} ${dispute.orderNumber} ${dispute.description}`
            .toLocaleLowerCase()
            .includes(search)) &&
        (!status || dispute.status === status),
    );
  }, [disputes, query, status]);
  const page = usePagination(filtered, { pageSize: 5 });

  function resetForm() {
    setOrderNumber("");
    setCategory("");
    setDescription("");
    setAttachmentUrl(null);
  }

  async function submit() {
    if (!orderNumber || !category || description.trim().length < 10) {
      toast.error("Choose an order and issue type, then describe what happened.");
      return;
    }
    setSaving(true);
    try {
      const result = await createDeliveryDispute({
        data: {
          orderNumber,
          category: category as (typeof categories)[number]["value"] &
            (
              | "missing_quantity"
              | "wrong_product"
              | "damaged_product"
              | "incorrect_price"
              | "order_not_received"
              | "other"
            ),
          description: description.trim(),
          attachmentUrl,
        },
      });
      await reload();
      resetForm();
      setOpen(false);
      toast.success("Delivery issue submitted", {
        description: `${result.disputeNumber} is now waiting for Management review.`,
      });
    } catch (cause) {
      toast.error("Could not submit issue", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function respond(disputeId: string) {
    setResponding(disputeId);
    try {
      await respondToDeliveryDispute({
        data: { disputeId, message: responses[disputeId]?.trim() ?? "" },
      });
      setResponses((current) => ({ ...current, [disputeId]: "" }));
      await reload();
      toast.success("Response added");
    } catch (cause) {
      toast.error("Could not add response", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setResponding(null);
    }
  }

  return (
    <BuyerLayout>
      <BuyerPageHeader
        title="Delivery Issues"
        description="Report a problem within 24 hours of delivery and track its resolution."
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="delivery issues"
        />
        {!loading && !error ? (
          <>
            <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CircleAlert className="mt-0.5 size-5 text-primary" />
                  <div>
                    <h2 className="font-semibold">Need help with a delivered order?</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      One report is allowed per delivery within 24 hours of handoff.
                    </p>
                  </div>
                </div>
                <Button
                  className="rounded-full"
                  disabled={!eligibleOrders.length}
                  onClick={() => setOpen(true)}
                >
                  <Plus className="size-4" /> Report an issue
                </Button>
              </div>
              {!eligibleOrders.length ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  No delivered order is currently within the reporting window.
                </p>
              ) : null}
            </section>
            <section className="mt-6">
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <Input
                  aria-label="Search delivery issues"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search case or order"
                />
                <AppSelect
                  ariaLabel="Filter delivery issue status"
                  value={status}
                  onValueChange={setStatus}
                  options={[
                    { value: "", label: "All case states" },
                    { value: "submitted", label: "Submitted" },
                    { value: "under_review", label: "Under review" },
                    { value: "waiting_response", label: "Waiting for response" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                    { value: "resolved", label: "Resolved" },
                  ]}
                />
              </div>
              {page.pageItems.length ? (
                <div className="space-y-4">
                  {page.pageItems.map((dispute) => (
                    <DeliveryDisputeCard
                      key={dispute.id}
                      dispute={dispute}
                      response={responses[dispute.id] ?? ""}
                      onResponseChange={(value) =>
                        setResponses((current) => ({ ...current, [dispute.id]: value }))
                      }
                      onRespond={() => void respond(dispute.id)}
                      responding={responding === dispute.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
                  <CircleAlert className="mx-auto size-8 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">
                    {disputes.length ? "No matching cases" : "No delivery issues reported"}
                  </h3>
                </div>
              )}
              <PaginationControls {...page} itemLabel="cases" />
            </section>
          </>
        ) : null}
      </main>

      <Dialog open={open} onOpenChange={(nextOpen) => !saving && setOpen(nextOpen)}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] overflow-y-auto rounded-3xl sm:max-w-xl">
          <DialogHeader className="text-left">
            <DialogTitle>Report a delivery issue</DialogTitle>
            <DialogDescription>
              Management will review the order, responses, and any supporting image.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Delivered order</Label>
              <AppSelect
                value={orderNumber}
                onValueChange={setOrderNumber}
                placeholder="Choose an order"
                options={eligibleOrders.map((order) => ({
                  value: order.orderNumber,
                  label: order.orderNumber,
                  description: `Delivered ${order.fulfilledAt?.toLocaleString("en-PH") ?? "recently"}`,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Issue type</Label>
              <AppSelect
                value={category}
                onValueChange={setCategory}
                placeholder="Choose an issue type"
                options={categories}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-issue-description">What happened?</Label>
              <Textarea
                id="delivery-issue-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the missing, damaged, incorrect, or undelivered item"
                maxLength={2_000}
                className="min-h-28"
              />
              <p className="text-right text-xs text-muted-foreground">{description.length}/2000</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-issue-photo">Supporting photo (optional)</Label>
              <Input
                id="delivery-issue-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return setAttachmentUrl(null);
                  void prepareProductImage(file)
                    .then(setAttachmentUrl)
                    .catch((cause) =>
                      toast.error(
                        cause instanceof Error ? cause.message : "Could not prepare image.",
                      ),
                    );
                }}
              />
              {attachmentUrl ? (
                <div className="relative">
                  <img
                    src={attachmentUrl}
                    alt="Issue attachment preview"
                    className="h-48 w-full rounded-2xl object-contain"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium shadow-sm">
                    <ImagePlus className="mr-1 inline size-3" /> Ready
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void submit()}>
              {saving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <CircleAlert className="size-4" />
              )}
              {saving ? "Submitting…" : "Submit issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BuyerLayout>
  );
}
