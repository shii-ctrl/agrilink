import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import {
  getFarmerApplications,
  reviewFarmerApplication,
} from "@/services/auth/farmer-application-server-functions";
import { toast } from "@/lib/ui/toast";

type Application = Awaited<ReturnType<typeof getFarmerApplications>>[number];

export function FarmerApplications({
  applications,
  onReviewed,
}: {
  applications: Application[];
  onReviewed: () => Promise<unknown>;
}) {
  const [status, setStatus] = useState("pending");
  const [query, setQuery] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);
  const actionPending = useRef(false);
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const filtered = applications.filter(
    (application) =>
      application.status === status &&
      `${application.name} ${application.username} ${application.contact ?? ""} ${application.farmingLocation}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const page = usePagination(filtered, { pageSize: 5 });

  async function review(application: Application, decision: "approved" | "rejected") {
    if (actionPending.current) return;
    actionPending.current = true;
    setWorking(application.userId);
    try {
      const reason = reasons[application.userId]?.trim() ?? "";
      if (
        !(await requestConfirmation({
          title:
            decision === "approved" ? "Approve Farmer application?" : "Reject Farmer application?",
          description:
            decision === "approved"
              ? `${application.name} will be able to sign in and access the Farmer workspace.`
              : `${application.name} will see this rejection reason when signing in: ${reason}`,
          confirmLabel: decision === "approved" ? "Approve Farmer" : "Reject application",
          destructive: decision === "rejected",
        }))
      )
        return;
      await reviewFarmerApplication({ data: { userId: application.userId, decision, reason } });
      toast.success(
        decision === "approved" ? "Farmer application approved" : "Farmer application rejected",
      );
      await onReviewed().catch(() =>
        toast.warning("Decision saved. Refresh the page to update the list."),
      );
    } catch (error) {
      toast.error("Could not review application", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      actionPending.current = false;
      setWorking(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      {confirmationDialog}
      <div className="border-b border-border p-5">
        <h2 className="text-lg font-semibold">Farmer Applications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review Farmer registrations before granting workspace access. Existing Farmers are already
          approved.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Application status">
          {(["pending", "approved", "rejected"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={status === value ? "default" : "outline"}
              aria-pressed={status === value}
              className="capitalize"
              onClick={() => {
                setStatus(value);
                page.setPage(1);
              }}
            >
              {value} ({applications.filter((application) => application.status === value).length})
            </Button>
          ))}
        </div>
        <Input
          className="mt-4"
          aria-label="Search Farmer applications"
          placeholder="Search name, username, contact, or farming location"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            page.setPage(1);
          }}
        />
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {page.pageItems.map((application) => (
          <article
            key={application.userId}
            className="min-w-0 space-y-3 rounded-2xl border border-border p-5"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-semibold">{application.name}</h3>
              <span className="text-sm capitalize text-primary">{application.status}</span>
            </div>
            <dl className="space-y-2 break-words text-sm">
              <div>
                <dt className="text-muted-foreground">Username</dt>
                <dd>{application.username}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Contact number</dt>
                <dd>{application.contact ?? "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Farming location</dt>
                <dd>{application.farmingLocation}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Submitted</dt>
                <dd>
                  {new Date(application.createdAt).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                  })}
                </dd>
              </div>
            </dl>
            {application.rejectionReason && (
              <p className="whitespace-pre-wrap break-words rounded-xl bg-muted p-3 text-sm">
                Reason: {application.rejectionReason}
              </p>
            )}
            {application.status === "pending" && (
              <div className="space-y-3 border-t border-border pt-3">
                <Label htmlFor={`reason-${application.userId}`}>Reason if rejecting</Label>
                <Textarea
                  id={`reason-${application.userId}`}
                  maxLength={1000}
                  value={reasons[application.userId] ?? ""}
                  onChange={(event) =>
                    setReasons((current) => ({
                      ...current,
                      [application.userId]: event.target.value,
                    }))
                  }
                  placeholder="Explain why this application is being rejected."
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={working !== null}
                    onClick={() => void review(application, "approved")}
                  >
                    {working === application.userId ? "Please wait…" : "Approve"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={
                      working !== null || (reasons[application.userId]?.trim().length ?? 0) < 5
                    }
                    onClick={() => void review(application, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </article>
        ))}
        {!filtered.length && (
          <p className="p-4 text-sm text-muted-foreground">
            No {status} applications match this view.
          </p>
        )}
      </div>
      <PaginationControls {...page} itemLabel="applications" />
    </section>
  );
}
