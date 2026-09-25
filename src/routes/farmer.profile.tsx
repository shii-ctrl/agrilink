import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { FarmerLayout, FarmerPageHeader } from "@/components/farmer-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/farmer/profile")({ component: FarmerProfilePage });
function FarmerProfilePage() {
  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="Profile"
        description="View the temporary Farmer Member account used for this prototype."
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <UserRound className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Juan Dela Cruz</h2>
              <p className="mt-1 text-sm text-muted-foreground">Farmer Member · PROCY supplier</p>
            </div>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue="Juan Dela Cruz" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact Number</Label>
              <Input id="contact" defaultValue="0917 555 0104" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input id="role" value="Farmer Member" readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Account Status</Label>
              <Input id="status" value="Active" readOnly />
            </div>
          </div>
          <Button
            className="mt-6 rounded-full"
            onClick={() =>
              toast("Profile updates are not saved yet", {
                description:
                  "This browser-only prototype will use MySQL when the backend is added.",
              })
            }
          >
            Save changes
          </Button>
        </section>
        <aside className="mt-6 flex gap-3 rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">
          <BadgeCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            Management controls Farmer Member accounts. This workspace shows only the farmer’s own
            production and receiving information.
          </p>
        </aside>
      </main>
    </FarmerLayout>
  );
}
