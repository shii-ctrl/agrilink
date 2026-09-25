import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { BuyerLayout, BuyerPageHeader } from "@/components/buyer-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/buyer/profile")({ component: BuyerProfilePage });
function BuyerProfilePage() {
  return (
    <BuyerLayout>
      <BuyerPageHeader
        title="Profile"
        description="View the temporary Buyer account information used for this AgriLink preview."
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <UserRound className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Carlo Mendoza</h2>
              <p className="mt-1 text-sm text-muted-foreground">Buyer account</p>
            </div>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue="Carlo Mendoza" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact Number</Label>
              <Input id="contact" defaultValue="0917 555 0106" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue="carlo@example.com" type="email" />
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
            Buyer accounts can self-register in the completed system. This current profile is
            temporary preview data only.
          </p>
        </aside>
      </main>
    </BuyerLayout>
  );
}
