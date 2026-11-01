import {
  BadgeCheck,
  Camera,
  Crop,
  ImagePlus,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

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
import {
  changeCurrentPassword,
  getCurrentSessionUser,
  updateCurrentProfile,
} from "@/services/auth/auth-functions";
import { minimumPasswordLength, passwordHelpText } from "@/features/auth/password-requirements";
import { CommunityFeed } from "@/features/messaging/components/community-feed";

const acceptedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumAvatarSize = 10 * 1024 * 1024;
const croppedAvatarSize = 320;
const maximumSavedAvatarBytes = 200 * 1024;

type AvatarDraft = {
  source: string;
  width: number;
  height: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function avatarGeometry(draft: AvatarDraft, size: number) {
  const sideways = Math.abs(draft.rotation % 180) === 90;
  const rotatedWidth = sideways ? draft.height : draft.width;
  const rotatedHeight = sideways ? draft.width : draft.height;
  const scale = Math.max(size / rotatedWidth, size / rotatedHeight) * draft.zoom;
  const boundsWidth = rotatedWidth * scale;
  const boundsHeight = rotatedHeight * scale;
  const maximumX = Math.max(0, (boundsWidth - size) / 2);
  const maximumY = Math.max(0, (boundsHeight - size) / 2);
  return {
    imageWidth: draft.width * scale,
    imageHeight: draft.height * scale,
    maximumX,
    maximumY,
    x: clamp(draft.offsetX, -1, 1) * maximumX,
    y: clamp(draft.offsetY, -1, 1) * maximumY,
  };
}

function AvatarPreview({
  avatarUrl,
  draft,
  size,
  className,
}: {
  avatarUrl: string | null;
  draft: AvatarDraft | null;
  size: number;
  className?: string;
}) {
  if (!draft && !avatarUrl) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center bg-accent text-accent-foreground ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        <UserRound className="size-5" />
      </span>
    );
  }

  const geometry = draft ? avatarGeometry(draft, size) : undefined;
  return (
    <span
      className={`relative block shrink-0 overflow-hidden bg-muted ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {draft && geometry ? (
        <span
          className="absolute left-1/2 top-1/2 block"
          style={{
            width: geometry.imageWidth,
            height: geometry.imageHeight,
            transform: `translate(-50%, -50%) translate(${geometry.x}px, ${geometry.y}px)`,
          }}
        >
          <img
            src={draft.source}
            alt="Profile preview"
            className="size-full max-w-none"
            style={{ transform: `rotate(${draft.rotation}deg)` }}
          />
        </span>
      ) : (
        <img
          src={avatarUrl ?? ""}
          alt="Profile preview"
          className="size-full object-cover"
          referrerPolicy="no-referrer"
        />
      )}
    </span>
  );
}

async function readAvatar(file: File): Promise<AvatarDraft> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The selected photo could not be read."));
    reader.readAsDataURL(file);
  });
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("The selected photo could not be opened."));
    image.src = source;
  });
  return { ...dimensions, source, zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 };
}

async function cropAvatar(draft: AvatarDraft) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("The selected photo could not be prepared."));
    nextImage.src = draft.source;
  });
  const canvas = document.createElement("canvas");
  canvas.width = croppedAvatarSize;
  canvas.height = croppedAvatarSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not crop this photo.");
  const geometry = avatarGeometry(draft, croppedAvatarSize);
  context.save();
  context.translate(croppedAvatarSize / 2 + geometry.x, croppedAvatarSize / 2 + geometry.y);
  context.rotate((draft.rotation * Math.PI) / 180);
  context.drawImage(
    image,
    -geometry.imageWidth / 2,
    -geometry.imageHeight / 2,
    geometry.imageWidth,
    geometry.imageHeight,
  );
  context.restore();
  for (const quality of [0.84, 0.76, 0.68, 0.6, 0.52, 0.44]) {
    const result = canvas.toDataURL("image/jpeg", quality);
    const base64 = result.split(",")[1] ?? "";
    const bytes = Math.ceil((base64.length * 3) / 4);
    if (bytes <= maximumSavedAvatarBytes) return result;
  }
  throw new Error("This photo could not be compressed below 200 KB. Try another photo.");
}

export function LiveProfile({
  role,
  showCommunityPosts = false,
}: {
  role: string;
  showCommunityPosts?: boolean;
}) {
  const [account, setAccount] = useState<Awaited<ReturnType<typeof getCurrentSessionUser>>>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<AvatarDraft | null>(null);
  const [cropDraft, setCropDraft] = useState<AvatarDraft | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [avatarVisibility, setAvatarVisibility] = useState("everyone");
  const [cropSize, setCropSize] = useState(croppedAvatarSize);
  const [dragging, setDragging] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cropAreaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  useEffect(() => {
    void getCurrentSessionUser().then((user) => {
      setAccount(user);
      setAvatarUrl(user?.avatarUrl ?? null);
      setAvatarVisibility(user?.avatarVisibility ?? "everyone");
    });
  }, []);

  useEffect(() => {
    const cropArea = cropAreaRef.current;
    if (!cropArea || !cropOpen) return;
    const measure = () => setCropSize(cropArea.getBoundingClientRect().width || croppedAvatarSize);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cropArea);
    return () => observer.disconnect();
  }, [cropOpen]);

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!acceptedAvatarTypes.has(file.type)) {
      toast.error("Choose a JPG, PNG, or WebP photo.");
      return;
    }
    if (file.size > maximumAvatarSize) {
      toast.error("Choose a photo smaller than 10 MB.");
      return;
    }
    try {
      setCropDraft(await readAvatar(file));
      setCropOpen(true);
    } catch (error) {
      toast.error("Photo could not be opened", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  function updateCropDraft(change: Partial<AvatarDraft>) {
    setCropDraft((current) => (current ? { ...current, ...change } : current));
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (!cropDraft) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: cropDraft.offsetX,
      offsetY: cropDraft.offsetY,
    };
    setDragging(true);
  }

  function moveCrop(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!cropDraft || !drag || drag.pointerId !== event.pointerId) return;
    const geometry = avatarGeometry(cropDraft, cropSize);
    updateCropDraft({
      offsetX:
        geometry.maximumX > 0
          ? clamp(drag.offsetX + (event.clientX - drag.startX) / geometry.maximumX, -1, 1)
          : 0,
      offsetY:
        geometry.maximumY > 0
          ? clamp(drag.offsetY + (event.clientY - drag.startY) / geometry.maximumY, -1, 1)
          : 0,
    });
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }

  function zoomCrop(nextZoom: number) {
    updateCropDraft({ zoom: clamp(nextZoom, 1, 3) });
  }

  function handleCropWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    if (cropDraft) zoomCrop(cropDraft.zoom - event.deltaY * 0.0015);
  }

  function handleCropKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!cropDraft) return;
    const movement = event.shiftKey ? 0.1 : 0.025;
    const changes: Partial<AvatarDraft> = {};
    if (event.key === "ArrowLeft") changes.offsetX = clamp(cropDraft.offsetX - movement, -1, 1);
    if (event.key === "ArrowRight") changes.offsetX = clamp(cropDraft.offsetX + movement, -1, 1);
    if (event.key === "ArrowUp") changes.offsetY = clamp(cropDraft.offsetY - movement, -1, 1);
    if (event.key === "ArrowDown") changes.offsetY = clamp(cropDraft.offsetY + movement, -1, 1);
    if (Object.keys(changes).length) {
      event.preventDefault();
      updateCropDraft(changes);
    }
  }

  function rotateCrop(amount: number) {
    if (!cropDraft) return;
    updateCropDraft({
      rotation: (cropDraft.rotation + amount + 360) % 360,
      offsetX: 0,
      offsetY: 0,
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const nextAvatarUrl = avatarDraft ? await cropAvatar(avatarDraft) : avatarUrl;
      const saved = await updateCurrentProfile({
        data: {
          displayName: String(formData.get("displayName") ?? ""),
          contact: String(formData.get("contact") ?? "").trim() || null,
          avatarUrl: nextAvatarUrl,
          avatarVisibility: String(formData.get("avatarVisibility") ?? "everyone") as
            "everyone" | "hidden",
        },
      });
      setAccount(saved);
      setAvatarUrl(saved.avatarUrl);
      setAvatarVisibility(saved.avatarVisibility);
      setAvatarDraft(null);
      window.dispatchEvent(
        new CustomEvent("agrilink:profile-updated", {
          detail: { role, displayName: saved.displayName, avatarUrl: saved.avatarUrl },
        }),
      );
      toast.success("Profile saved");
    } catch (error) {
      toast.error("Profile could not be saved", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const newPassword = String(formData.get("newPassword") ?? "");
    if (newPassword !== String(formData.get("confirmPassword") ?? "")) {
      toast.error("New passwords do not match.");
      return;
    }
    try {
      await changeCurrentPassword({
        data: {
          currentPassword: String(formData.get("currentPassword") ?? ""),
          newPassword,
        },
      });
      form.reset();
      toast.success("Password changed");
    } catch (error) {
      toast.error("Password could not be changed", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }
  if (!account)
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 text-sm text-muted-foreground md:px-8">
        Loading saved account information…
      </main>
    );
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      <section className="rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
        <div className="flex items-start gap-3">
          <AvatarPreview
            avatarUrl={avatarUrl}
            draft={avatarDraft}
            size={44}
            className="rounded-2xl border border-border"
          />
          <div>
            <h2 className="text-xl font-semibold">{account.displayName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{role} account</p>
          </div>
        </div>
        <form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              name="displayName"
              defaultValue={account.displayName}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-contact">Contact number</Label>
            <Input id="profile-contact" name="contact" defaultValue={account.contact ?? ""} />
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Label>Profile photo</Label>
            <div className="flex flex-col gap-5 rounded-2xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-start">
              <AvatarPreview
                avatarUrl={avatarUrl}
                draft={avatarDraft}
                size={144}
                className="rounded-full border border-border shadow-sm"
              />
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="font-medium">Choose and adjust your photo</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your photo will be cropped to a square before it is saved.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <ImagePlus className="mr-2 size-4" />
                    {avatarUrl || avatarDraft ? "Replace photo" : "Choose photo"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="mr-2 size-4" />
                    Take photo
                  </Button>
                  {(avatarUrl || avatarDraft) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setAvatarUrl(null);
                        setAvatarDraft(null);
                        setCropDraft(null);
                      }}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Remove
                    </Button>
                  )}
                  {avatarDraft && (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setCropDraft({ ...avatarDraft });
                        setCropOpen(true);
                      }}
                    >
                      <Crop className="mr-2 size-4" />
                      Adjust crop
                    </Button>
                  )}
                  <Input
                    ref={avatarInputRef}
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={chooseAvatar}
                  />
                  <Input
                    ref={cameraInputRef}
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={chooseAvatar}
                  />
                </div>
                {avatarDraft && (
                  <p className="text-sm text-primary">
                    Crop ready. Save changes to update your profile everywhere.
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, or WebP up to 10 MB. Saved photos are compressed to 200 KB or less.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="avatar-visibility">Who can see your profile photo?</Label>
            <select
              id="avatar-visibility"
              name="avatarVisibility"
              value={avatarVisibility}
              onChange={(event) => setAvatarVisibility(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:max-w-md"
            >
              <option value="everyone">Everyone</option>
              <option value="hidden">Only me</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Your initials are shown anywhere your photo is hidden.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              value={account.email ?? "No email is linked to this username-only account"}
              readOnly
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-role">Role</Label>
            <Input id="profile-role" value={account.roles.join(", ")} readOnly />
          </div>
          <Button type="submit" className="rounded-full sm:col-span-2 sm:w-fit">
            Save changes
          </Button>
        </form>
      </section>
      <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
        <h2 className="text-lg font-semibold">Change password</h2>
        <p className="mt-1 text-sm text-muted-foreground">{passwordHelpText}</p>
        <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={changePassword}>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={minimumPasswordLength}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={minimumPasswordLength}
              required
            />
          </div>
          <Button type="submit" variant="outline" className="rounded-full sm:w-fit">
            Change password
          </Button>
        </form>
      </section>
      <aside className="mt-6 flex gap-3 rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">
        <BadgeCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          Your name and contact information are saved in Layerbase. Your account role is managed
          separately and cannot be changed here.
        </p>
      </aside>
      {showCommunityPosts && (
        <div className="mt-6">
          <CommunityFeed title="My Community posts" scope="mine" showComposer={false} />
        </div>
      )}
      <Dialog
        open={cropOpen}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open) {
            dragRef.current = null;
            setDragging(false);
          }
        }}
      >
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Crop your profile photo</DialogTitle>
            <DialogDescription>
              Drag the photo to reposition it. Use the slider or mouse wheel to zoom.
            </DialogDescription>
          </DialogHeader>
          {cropDraft && (
            <div className="space-y-5">
              <div className="mx-auto w-full max-w-[360px] rounded-3xl bg-foreground/90 p-3 shadow-inner">
                <div
                  ref={cropAreaRef}
                  role="application"
                  tabIndex={0}
                  aria-label="Profile photo crop area. Drag or use arrow keys to reposition."
                  className={`relative aspect-square w-full touch-none select-none overflow-hidden rounded-full bg-muted outline-none ring-2 ring-background focus-visible:ring-primary ${
                    dragging ? "cursor-grabbing" : "cursor-grab"
                  }`}
                  onPointerDown={beginDrag}
                  onPointerMove={moveCrop}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onWheel={handleCropWheel}
                  onKeyDown={handleCropKeys}
                >
                  <AvatarPreview
                    avatarUrl={null}
                    draft={cropDraft}
                    size={cropSize}
                    className="absolute inset-0 rounded-full"
                  />
                  <span className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/35" />
                  <span className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/35" />
                  <span className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/35" />
                  <span className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/35" />
                  <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/70" />
                </div>
              </div>
              <label className="block space-y-2 text-sm font-medium">
                <span className="flex items-center justify-between">
                  <span>Zoom</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {Math.round(cropDraft.zoom * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={cropDraft.zoom}
                  onChange={(event) => zoomCrop(Number(event.target.value))}
                  className="w-full accent-primary"
                />
              </label>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" onClick={() => rotateCrop(-90)}>
                  <RotateCcw className="mr-2 size-4" />
                  Rotate left
                </Button>
                <Button type="button" variant="outline" onClick={() => rotateCrop(90)}>
                  <RotateCw className="mr-2 size-4" />
                  Rotate right
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateCropDraft({ zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 })}
                >
                  <RefreshCcw className="mr-2 size-4" />
                  Reset
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCropOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!cropDraft}
              onClick={() => {
                if (!cropDraft) return;
                setAvatarDraft({ ...cropDraft });
                setCropOpen(false);
              }}
            >
              <Crop className="mr-2 size-4" />
              Apply crop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
