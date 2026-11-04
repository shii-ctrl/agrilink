import { LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/ui/toast";

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
import {
  reportDeliveryIssue,
  submitDeliveryProof,
} from "@/services/marketplace/marketplace-server-functions";

type DialogProps = {
  orderNumber: string | null;
  expectedRecipientName?: string | null;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
};

export function DeliveryCompletionDialog({
  orderNumber,
  expectedRecipientName,
  onClose,
  onSaved,
}: DialogProps) {
  const [recipientName, setRecipientName] = useState("");
  const [otp, setOtp] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setRecipientName("");
    setOtp("");
  }

  async function save() {
    if (!orderNumber || recipientName.trim().length < 2 || otp.length !== 6) {
      toast.error("Enter the 6-digit OTP and recipient name.");
      return;
    }
    const normalizeName = (value: string) =>
      value
        .normalize("NFKC")
        .toLocaleLowerCase("en-PH")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    if (
      expectedRecipientName &&
      normalizeName(recipientName) !== normalizeName(expectedRecipientName)
    ) {
      toast.error("Recipient name does not match", {
        description: "Enter the delivery recipient name shown on this assignment.",
      });
      return;
    }
    setSaving(true);
    try {
      await submitDeliveryProof({
        data: {
          orderNumber,
          otp,
          recipientName: recipientName.trim(),
        },
      });
      await onSaved();
      reset();
      onClose();
      toast.success("Delivery verified", {
        description: "The Buyer and PROCY were notified. COD is now marked Collected.",
      });
    } catch (cause) {
      toast.error("Could not complete delivery", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={Boolean(orderNumber)}
      onOpenChange={(open) => {
        if (!open && !saving) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] overflow-y-auto rounded-3xl sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle>Complete delivery</DialogTitle>
          <DialogDescription>
            Verify the Buyer OTP and recipient name before marking {orderNumber} Delivered.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="delivery-otp">Buyer delivery OTP</Label>
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
              <Input
                id="delivery-otp"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="6-digit OTP"
                className="pl-10 font-mono tracking-[0.3em]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-recipient">Actual recipient name</Label>
            <Input
              id="delivery-recipient"
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              placeholder="Name of person who received the order"
              maxLength={160}
            />
            {expectedRecipientName ? (
              <p className="text-xs text-muted-foreground">
                Must match the delivery recipient: {expectedRecipientName}
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {saving ? "Verifying…" : "Verify and mark delivered"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeliveryIssueDialog({ orderNumber, onClose, onSaved }: DialogProps) {
  const [outcome, setOutcome] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [nextSchedule, setNextSchedule] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={Boolean(orderNumber)} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] rounded-3xl sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>Report delivery issue</DialogTitle>
          <DialogDescription>
            Save why {orderNumber} could not be delivered. The Buyer and Management will be
            notified.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Outcome</Label>
            <AppSelect
              value={outcome}
              onValueChange={setOutcome}
              placeholder="Choose delivery outcome"
              options={[
                { value: "buyer_unavailable", label: "Buyer unavailable" },
                { value: "wrong_address", label: "Wrong address" },
                { value: "refused", label: "Delivery refused" },
                { value: "rescheduled", label: "Rescheduled" },
              ]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-issue-note">Details</Label>
            <Textarea
              id="delivery-issue-note"
              value={reasonNote}
              onChange={(event) => setReasonNote(event.target.value)}
              placeholder="Describe what happened"
              maxLength={1_000}
            />
          </div>
          {outcome === "rescheduled" ? (
            <div className="space-y-2">
              <Label htmlFor="next-delivery-schedule">New schedule</Label>
              <Input
                id="next-delivery-schedule"
                value={nextSchedule}
                onChange={(event) => setNextSchedule(event.target.value)}
                placeholder="Example: Nov 4, 9:00 AM–12:00 PM"
                maxLength={255}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={
              saving ||
              !outcome ||
              reasonNote.trim().length < 3 ||
              (outcome === "rescheduled" && !nextSchedule.trim())
            }
            onClick={async () => {
              if (!orderNumber) return;
              setSaving(true);
              try {
                await reportDeliveryIssue({
                  data: {
                    orderNumber,
                    outcome: outcome as
                      "buyer_unavailable" | "wrong_address" | "refused" | "rescheduled",
                    reasonNote: reasonNote.trim(),
                    ...(nextSchedule.trim() ? { nextSchedule: nextSchedule.trim() } : {}),
                  },
                });
                await onSaved();
                onClose();
                setOutcome("");
                setReasonNote("");
                setNextSchedule("");
                toast.success("Delivery issue recorded");
              } catch (cause) {
                toast.error("Could not save delivery issue", {
                  description: cause instanceof Error ? cause.message : "Please try again.",
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            <TriangleAlert className="size-4" /> {saving ? "Saving…" : "Save delivery issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
