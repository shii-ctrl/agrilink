import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle, Scale } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { DeliveryDisputeCard } from "@/features/marketplace/components/delivery-dispute-card";
import type { DeliveryDispute } from "@/features/marketplace/delivery-disputes";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  getOperationalDeliveryDisputes,
  respondToDeliveryDispute,
  reviewDeliveryDispute,
} from "@/services/marketplace/delivery-dispute-server-functions";

export const Route = createFileRoute("/management/disputes")({ component: ManagementDisputes });

type ReviewDraft = {
  status: string;
  resolution: string;
  note: string;
  refundAmount: string;
};

function draftFor(dispute: DeliveryDispute): ReviewDraft {
  return {
    status: dispute.status,
    resolution: dispute.resolution ?? "",
    note: dispute.resolutionNote ?? "",
    refundAmount: dispute.refundAmount?.toString() ?? "",
  };
}

function ManagementDisputes() {
  const request = useCallback(() => getOperationalDeliveryDisputes(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const disputes = useMemo(() => data ?? [], [data]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [working, setWorking] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return disputes.filter(
      (dispute) =>
        (!search ||
          `${dispute.disputeNumber} ${dispute.orderNumber} ${dispute.buyerName} ${dispute.description}`
            .toLocaleLowerCase()
            .includes(search)) &&
        (!status || dispute.status === status),
    );
  }, [disputes, query, status]);
  const page = usePagination(filtered, { pageSize: 5 });
  const openCount = disputes.filter(
    (dispute) => !["rejected", "resolved"].includes(dispute.status),
  ).length;

  function updateDraft(dispute: DeliveryDispute, key: keyof ReviewDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [dispute.id]: { ...(current[dispute.id] ?? draftFor(dispute)), [key]: value },
    }));
  }

  async function saveReview(dispute: DeliveryDispute) {
    const draft = drafts[dispute.id] ?? draftFor(dispute);
    setWorking(dispute.id);
    try {
      await reviewDeliveryDispute({
        data: {
          disputeId: dispute.id,
          status: draft.status as
            | "submitted"
            | "under_review"
            | "waiting_response"
            | "approved"
            | "rejected"
            | "resolved",
          resolution: (draft.resolution || null) as
            | "replace_product"
            | "partial_refund"
            | "full_refund"
            | "credit_next_order"
            | "no_action"
            | null,
          resolutionNote: draft.note.trim(),
          refundAmount: draft.refundAmount ? Number(draft.refundAmount) : null,
        },
      });
      await reload();
      toast.success("Case review saved");
    } catch (cause) {
      toast.error("Could not save review", {
        description: cause instanceof Error ? cause.message : "Please check the case details.",
      });
    } finally {
      setWorking(null);
    }
  }

  async function respond(dispute: DeliveryDispute) {
    setWorking(dispute.id);
    try {
      await respondToDeliveryDispute({
        data: { disputeId: dispute.id, message: responses[dispute.id]?.trim() ?? "" },
      });
      setResponses((current) => ({ ...current, [dispute.id]: "" }));
      await reload();
      toast.success("Management response added");
    } catch (cause) {
      toast.error("Could not add response", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setWorking(null);
    }
  }

  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Delivery Disputes"
        description="Review Buyer delivery concerns, collect responses, and record a final resolution."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="delivery disputes"
        />
        {!loading && !error ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
                <p className="text-sm text-muted-foreground">Open cases</p>
                <p className="mt-1 font-display text-3xl font-semibold">{openCount}</p>
              </div>
              <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
                <p className="text-sm text-muted-foreground">Total recorded cases</p>
                <p className="mt-1 font-display text-3xl font-semibold">{disputes.length}</p>
              </div>
            </section>
            <section className="my-6 rounded-3xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start gap-3">
                <Scale className="mt-0.5 size-5 text-primary" />
                <div>
                  <h2 className="font-semibold">Resolution queue</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Refund decisions are forwarded to Accounting. Other resolutions close here.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input
                  aria-label="Search delivery disputes"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search case, order, or Buyer"
                />
                <AppSelect
                  ariaLabel="Filter dispute status"
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
            </section>
            {page.pageItems.length ? (
              <div className="space-y-5">
                {page.pageItems.map((dispute) => {
                  const draft = drafts[dispute.id] ?? draftFor(dispute);
                  return (
                    <DeliveryDisputeCard
                      key={dispute.id}
                      dispute={dispute}
                      response={responses[dispute.id] ?? ""}
                      onResponseChange={(value) =>
                        setResponses((current) => ({ ...current, [dispute.id]: value }))
                      }
                      onRespond={() => void respond(dispute)}
                      responding={working === dispute.id}
                      actions={
                        <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                          <h4 className="font-semibold">Management decision</h4>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Case status</Label>
                              <AppSelect
                                value={draft.status}
                                onValueChange={(value) => updateDraft(dispute, "status", value)}
                                options={[
                                  { value: "submitted", label: "Submitted" },
                                  { value: "under_review", label: "Under review" },
                                  { value: "waiting_response", label: "Waiting for response" },
                                  { value: "approved", label: "Approved" },
                                  { value: "rejected", label: "Rejected" },
                                  { value: "resolved", label: "Resolved" },
                                ]}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Resolution</Label>
                              <AppSelect
                                value={draft.resolution}
                                onValueChange={(value) => updateDraft(dispute, "resolution", value)}
                                placeholder="Choose a resolution"
                                options={[
                                  { value: "replace_product", label: "Replace product" },
                                  { value: "partial_refund", label: "Partial refund" },
                                  { value: "full_refund", label: "Full refund" },
                                  { value: "credit_next_order", label: "Credit on next order" },
                                  { value: "no_action", label: "No action" },
                                ]}
                              />
                            </div>
                          </div>
                          {draft.resolution === "partial_refund" ? (
                            <div className="space-y-2">
                              <Label htmlFor={`refund-${dispute.id}`}>
                                Approved refund amount (₱)
                              </Label>
                              <Input
                                id={`refund-${dispute.id}`}
                                type="number"
                                min="0.01"
                                max={dispute.totalAmount}
                                step="0.01"
                                value={draft.refundAmount}
                                onChange={(event) =>
                                  updateDraft(dispute, "refundAmount", event.target.value)
                                }
                              />
                            </div>
                          ) : null}
                          <div className="space-y-2">
                            <Label htmlFor={`decision-${dispute.id}`}>
                              Decision or review note
                            </Label>
                            <Textarea
                              id={`decision-${dispute.id}`}
                              value={draft.note}
                              onChange={(event) => updateDraft(dispute, "note", event.target.value)}
                              placeholder="Explain the review status or final decision"
                              maxLength={2_000}
                            />
                          </div>
                          <Button
                            type="button"
                            className="rounded-full"
                            disabled={working !== null || draft.note.trim().length < 3}
                            onClick={() => void saveReview(dispute)}
                          >
                            {working === dispute.id ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <Scale className="size-4" />
                            )}
                            Save review
                          </Button>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
                <CircleAlert className="mx-auto size-8 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">
                  {disputes.length ? "No matching cases" : "No delivery disputes yet"}
                </h3>
              </div>
            )}
            <PaginationControls {...page} itemLabel="cases" />
          </>
        ) : null}
      </main>
    </ManagementLayout>
  );
}
