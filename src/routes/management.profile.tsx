import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ManagementLayout, ManagementPageHeader } from "@/components/management-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoUsers } from "@/lib/demo-data";

export const Route = createFileRoute("/management/profile")({
  head: () => ({
    meta: [{ title: "Profile — Management | AgriLink" }],
  }),
  component: ManagementProfilePage,
});

const managementUser = demoUsers.find((user) => user.role === "Management");

function ManagementProfilePage() {
  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Profile"
        description="View and update basic personal and account information. Your role cannot be changed here."
      />

      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_18rem] md:px-8">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <UserRound className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Personal information</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Temporary demo profile details for interface review.
              </p>
            </div>
          </div>

          <form
            className="mt-8 grid gap-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              toast("Profile update is not available yet", {
                description: "This prototype does not yet save account information.",
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" defaultValue={managementUser?.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-contact">Contact information</Label>
              <Input
                id="profile-contact"
                type="tel"
                defaultValue={managementUser?.contact}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-role">Role</Label>
              <Input id="profile-role" defaultValue="Management" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-username">Username</Label>
              <Input id="profile-username" defaultValue="management.demo" disabled />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="rounded-full">
                Update profile
              </Button>
            </div>
          </form>
        </section>

        <aside className="h-fit rounded-3xl border border-border bg-card p-6 shadow-card">
          <KeyRound className="size-6 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Account information</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Account status</dt>
              <dd className="mt-1 font-medium text-primary">Active</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Password</dt>
              <dd className="mt-1">
                Password changes will be available with MySQL authentication.
              </dd>
            </div>
          </dl>
        </aside>
      </main>
    </ManagementLayout>
  );
}
