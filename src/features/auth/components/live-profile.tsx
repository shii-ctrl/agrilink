import { BadgeCheck, UserRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
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

export function LiveProfile({
  role,
  showCommunityPosts = false,
}: {
  role: string;
  showCommunityPosts?: boolean;
}) {
  const [account, setAccount] = useState<Awaited<ReturnType<typeof getCurrentSessionUser>>>(null);
  useEffect(() => {
    void getCurrentSessionUser().then(setAccount);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const saved = await updateCurrentProfile({
        data: {
          displayName: String(formData.get("displayName") ?? ""),
          contact: String(formData.get("contact") ?? "").trim() || null,
          avatarUrl: String(formData.get("avatarUrl") ?? "").trim() || null,
        },
      });
      setAccount(saved);
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
          {account.avatarUrl ? (
            <img
              src={account.avatarUrl}
              alt="Profile"
              className="size-11 rounded-2xl border border-border object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <UserRound className="size-5" />
            </span>
          )}
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
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="profile-avatar">Profile photo URL (optional)</Label>
            <Input
              id="profile-avatar"
              name="avatarUrl"
              type="url"
              autoComplete="url"
              defaultValue={account.avatarUrl ?? ""}
              placeholder="https://example.com/your-photo.jpg"
            />
            <p className="text-xs text-muted-foreground">
              Use a public HTTPS image URL. AgriLink does not store image files or social-media
              photos.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={account.email} readOnly />
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
