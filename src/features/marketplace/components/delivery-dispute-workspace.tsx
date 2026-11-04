import { CircleAlert } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { AppSelect } from "@/components/ui/app-select";
import { Input } from "@/components/ui/input";
import { DeliveryDisputeCard } from "@/features/marketplace/components/delivery-dispute-card";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  getOperationalDeliveryDisputes,
  respondToDeliveryDispute,
} from "@/services/marketplace/delivery-dispute-server-functions";

export function DeliveryDisputeWorkspace({ scopeLabel }: { scopeLabel: string }) {
  const request = useCallback(() => getOperationalDeliveryDisputes(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const disputes = useMemo(() => data ?? [], [data]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [responding, setResponding] = useState<string | null>(null);
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
  const page = usePagination(filtered, { pageSize: 6 });

  async function respond(disputeId: string) {
    setResponding(disputeId);
    try {
      await respondToDeliveryDispute({
        data: { disputeId, message: responses[disputeId]?.trim() ?? "" },
      });
      setResponses((current) => ({ ...current, [disputeId]: "" }));
      await reload();
      toast.success("Response sent to the case");
    } catch (cause) {
      toast.error("Could not send response", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setResponding(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <WorkspaceLoadState
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        label={`${scopeLabel} delivery disputes`}
      />
      {!loading && !error ? (
        <>
          <section className="mb-6 rounded-3xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 text-primary" />
              <div>
                <h2 className="font-semibold">Cases needing operational context</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add factual order, product, or delivery information. Management makes the final
                  decision.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Search delivery dispute cases"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search case, order, or Buyer"
              />
              <AppSelect
                ariaLabel="Filter delivery dispute status"
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
                {disputes.length ? "No matching cases" : "No delivery cases assigned"}
              </h3>
            </div>
          )}
          <PaginationControls {...page} itemLabel="cases" />
        </>
      ) : null}
    </main>
  );
}
