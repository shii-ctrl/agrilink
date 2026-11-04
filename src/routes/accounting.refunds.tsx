import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleDollarSign, LoaderCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountingLayout, AccountingPageHeader } from "@/components/workspaces/accounting-layout";
import { disputeResolutionLabels } from "@/features/marketplace/delivery-disputes";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  getAccountingDeliveryRefunds,
  processDeliveryDisputeRefund,
} from "@/services/marketplace/delivery-dispute-server-functions";

export const Route = createFileRoute("/accounting/refunds")({ component: AccountingRefunds });

function AccountingRefunds() {
  const request = useCallback(() => getAccountingDeliveryRefunds(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const refunds = useMemo(() => data ?? [], [data]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return refunds.filter(
      (refund) =>
        (!search ||
          `${refund.disputeNumber} ${refund.orderNumber} ${refund.buyerName}`
            .toLocaleLowerCase()
            .includes(search)) &&
        (!status || refund.refundStatus === status),
    );
  }, [query, refunds, status]);
  const page = usePagination(filtered, { pageSize: 10 });
  const pendingTotal = refunds
    .filter((refund) => refund.refundStatus === "pending")
    .reduce((sum, refund) => sum + (refund.refundAmount ?? 0), 0);

  async function processRefund(disputeId: string) {
    setProcessing(disputeId);
    try {
      await processDeliveryDisputeRefund({ data: { disputeId } });
      await reload();
      toast.success("Refund marked as processed", {
        description: "The Buyer and Management were notified and the case was resolved.",
      });
    } catch (cause) {
      toast.error("Could not process refund", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setProcessing(null);
    }
  }

  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Delivery Refunds"
        description="Process refunds approved by Management and close their delivery cases."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="delivery refunds"
        />
        {!loading && !error ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
                <p className="text-sm text-muted-foreground">Refunds awaiting processing</p>
                <p className="mt-1 font-display text-3xl font-semibold">
                  {refunds.filter((refund) => refund.refundStatus === "pending").length}
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
                <p className="text-sm text-muted-foreground">Pending amount</p>
                <p className="mt-1 font-display text-3xl font-semibold">
                  ₱{pendingTotal.toFixed(2)}
                </p>
              </div>
            </section>
            <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="border-b border-border p-5">
                <div className="flex items-start gap-3">
                  <CircleDollarSign className="mt-0.5 size-5 text-primary" />
                  <div>
                    <h2 className="font-semibold">Approved refund queue</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Only Management-approved delivery refunds appear here.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Input
                    aria-label="Search delivery refunds"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search case, order, or Buyer"
                  />
                  <AppSelect
                    ariaLabel="Filter delivery refund status"
                    value={status}
                    onValueChange={setStatus}
                    options={[
                      { value: "", label: "All refund states" },
                      { value: "pending", label: "Pending" },
                      { value: "processed", label: "Processed" },
                    ]}
                  />
                </div>
              </div>
              {page.pageItems.length ? (
                <div className="divide-y divide-border">
                  {page.pageItems.map((refund) => (
                    <article
                      key={refund.id}
                      className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{refund.disputeNumber}</p>
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            {refund.refundStatus === "pending" ? "Pending" : "Processed"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {refund.orderNumber} · {refund.buyerName}
                        </p>
                        <p className="mt-2 text-sm">
                          {refund.resolution
                            ? disputeResolutionLabels[refund.resolution]
                            : "Approved refund"}
                          {refund.resolutionNote ? ` · ${refund.resolutionNote}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 md:justify-end">
                        <p className="font-display text-2xl font-semibold">
                          ₱{(refund.refundAmount ?? 0).toFixed(2)}
                        </p>
                        {refund.refundStatus === "pending" ? (
                          <Button
                            className="rounded-full"
                            disabled={processing !== null}
                            onClick={() => void processRefund(refund.id)}
                          >
                            {processing === refund.id ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-4" />
                            )}
                            Mark processed
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <CircleDollarSign className="mx-auto size-8 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">
                    {refunds.length ? "No matching refunds" : "No approved delivery refunds"}
                  </h3>
                </div>
              )}
              <PaginationControls {...page} itemLabel="refunds" />
            </section>
          </>
        ) : null}
      </main>
    </AccountingLayout>
  );
}
