import { BadgeCheck, ImagePlus, Trash2, UserRound } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

type AvatarDraft = {
  source: string;
  width: number;
  height: number;
  zoom: number;
  horizontal: number;
  vertical: number;
};

function avatarPlacement(draft: AvatarDraft, size: number) {
  const scale = Math.max(size / draft.width, size / draft.height) * draft.zoom;
  const width = draft.width * scale;
  const height = draft.height * scale;
  return {
    width,
    height,
    left: (size - width) * (draft.horizontal / 100),
    top: (size - height) * (draft.vertical / 100),
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

  const placement = draft ? avatarPlacement(draft, size) : undefined;
  return (
    <span
      className={`relative block shrink-0 overflow-hidden bg-muted ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <img
        src={draft?.source ?? avatarUrl ?? ""}
        alt="Profile preview"
        className={draft ? "absolute max-w-none" : "size-full object-cover"}
        style={placement}
        referrerPolicy="no-referrer"
      />
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
  return { ...dimensions, source, zoom: 1, horizontal: 50, vertical: 50 };
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
  const placement = avatarPlacement(draft, croppedAvatarSize);
  context.drawImage(image, placement.left, placement.top, placement.width, placement.height);
  return canvas.toDataURL("image/jpeg", 0.84);
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
  const avatarInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void getCurrentSessionUser().then((user) => {
      setAccount(user);
      setAvatarUrl(user?.avatarUrl ?? null);
    });
  }, []);

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
      setAvatarDraft(await readAvatar(file));
    } catch (error) {
      toast.error("Photo could not be opened", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  function updateAvatarDraft(change: Partial<AvatarDraft>) {
    setAvatarDraft((current) => (current ? { ...current, ...change } : current));
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
        },
      });
      setAccount(saved);
      setAvatarUrl(saved.avatarUrl);
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
                  {(avatarUrl || avatarDraft) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setAvatarUrl(null);
                        setAvatarDraft(null);
                      }}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Remove
                    </Button>
                  )}
                  <Input
                    ref={avatarInputRef}
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={chooseAvatar}
                  />
                </div>
                {avatarDraft && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-2 text-sm font-medium">
                      Zoom
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.01"
                        value={avatarDraft.zoom}
                        onChange={(event) =>
                          updateAvatarDraft({ zoom: Number(event.target.value) })
                        }
                        className="w-full accent-primary"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Move left / right
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={avatarDraft.horizontal}
                        onChange={(event) =>
                          updateAvatarDraft({ horizontal: Number(event.target.value) })
                        }
                        className="w-full accent-primary"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Move up / down
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={avatarDraft.vertical}
                        onChange={(event) =>
                          updateAvatarDraft({ vertical: Number(event.target.value) })
                        }
                        className="w-full accent-primary"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP up to 10 MB.</p>
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
    </main>
  );
}
