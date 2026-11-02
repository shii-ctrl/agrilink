import { Camera, Eraser, LoaderCircle, MapPin, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { toast } from "sonner";

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
import { prepareProductImage } from "@/features/marketplace/product-image-upload";
import {
  reportDeliveryIssue,
  submitDeliveryProof,
} from "@/services/marketplace/marketplace-server-functions";

type DialogProps = {
  orderNumber: string | null;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
};

export function DeliveryCompletionDialog({ orderNumber, onClose, onSaved }: DialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [recipientName, setRecipientName] = useState("");
  const [otp, setOtp] = useState("");
  const [photo, setPhoto] = useState("");
  const [signed, setSigned] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setRecipientName("");
    setOtp("");
    setPhoto("");
    setSigned(false);
    setLocation(null);
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, 600, 220);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    if (!context) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * canvas.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * canvas.height;
    context.lineWidth = 4;
    context.lineCap = "round";
    context.strokeStyle = "#0b3d24";
    context.lineTo(x, y);
    context.stroke();
    setSigned(true);
  }

  async function save() {
    if (!orderNumber || !photo || !signed || recipientName.trim().length < 2 || otp.length !== 6) {
      toast.error("Complete the OTP, recipient, photo, and signature.");
      return;
    }
    const signatureUrl = canvasRef.current?.toDataURL("image/png") ?? "";
    setSaving(true);
    try {
      await submitDeliveryProof({
        data: {
          orderNumber,
          otp,
          recipientName: recipientName.trim(),
          proofPhotoUrl: photo,
          signatureUrl,
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
        },
      });
      await onSaved();
      reset();
      onClose();
      toast.success("Delivery proof verified", {
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
            Verify the Buyer OTP and save proof before marking {orderNumber} Delivered.
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-photo">Proof photo</Label>
            <Input
              id="delivery-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void prepareProductImage(file)
                  .then(setPhoto)
                  .catch((cause) =>
                    toast.error(
                      cause instanceof Error ? cause.message : "Could not prepare photo.",
                    ),
                  );
              }}
            />
            {photo ? (
              <img
                src={photo}
                alt="Delivery proof preview"
                className="h-44 w-full rounded-xl object-cover"
              />
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Buyer or recipient signature</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  canvasRef.current?.getContext("2d")?.clearRect(0, 0, 600, 220);
                  setSigned(false);
                }}
              >
                <Eraser className="size-4" /> Clear
              </Button>
            </div>
            <canvas
              ref={canvasRef}
              width={600}
              height={220}
              className="h-36 w-full touch-none rounded-xl border border-border bg-white"
              onPointerDown={(event) => {
                drawing.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                const context = event.currentTarget.getContext("2d");
                const bounds = event.currentTarget.getBoundingClientRect();
                context?.beginPath();
                context?.moveTo(
                  ((event.clientX - bounds.left) / bounds.width) * event.currentTarget.width,
                  ((event.clientY - bounds.top) / bounds.height) * event.currentTarget.height,
                );
              }}
              onPointerMove={draw}
              onPointerUp={() => (drawing.current = false)}
              onPointerCancel={() => (drawing.current = false)}
              aria-label="Recipient signature pad"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              if (!navigator.geolocation) {
                toast.error("Location is not available on this device.");
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (position) =>
                  setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                  }),
                () => toast.error("Location permission was not granted."),
                { enableHighAccuracy: true, timeout: 10_000 },
              );
            }}
          >
            <MapPin className="size-4" />{" "}
            {location ? "Location captured" : "Add current location (optional)"}
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
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
