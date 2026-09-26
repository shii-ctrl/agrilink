import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Leaf, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInitialManagementAccount } from "@/lib/admin-server-functions";

export const Route = createFileRoute("/setup-management")({
  head: () => ({
    meta: [
      { title: "Initial Management Setup — AgriLink" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SetupManagementPage,
});

function SetupManagementPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <section className="w-full max-w-lg rounded-3xl border bg-card p-8 shadow-sm sm:p-10">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full surface-sprout">
            <Leaf className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">AgriLink</span>
        </Link>
        <Link
          to="/"
          className="mt-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Home
        </Link>

        <div className="mt-7 flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold">
              Create the first Management account
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This one-time setup is available only while no Management account exists.
            </p>
          </div>
        </div>

        <form
          className="mt-8 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            if (formData.get("password") !== formData.get("confirmPassword")) {
              toast("Passwords do not match", {
                description: "Enter the same password in both password fields.",
              });
              return;
            }
            setSubmitting(true);
            try {
              await createInitialManagementAccount({
                data: {
                  name: String(formData.get("name") ?? ""),
                  contact: String(formData.get("contact") ?? ""),
                  email: String(formData.get("email") ?? ""),
                  password: String(formData.get("password") ?? ""),
                  setupSecret: String(formData.get("setupSecret") ?? ""),
                },
              });
              form.reset();
              toast("Management account created", {
                description:
                  "Remove INITIAL_MANAGEMENT_SETUP_SECRET from the deployment now, then sign in.",
              });
              navigate({ to: "/login" });
            } catch (error) {
              toast("Unable to complete initial setup", {
                description:
                  error instanceof Error ? error.message : "Check the setup secret and try again.",
              });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact">Contact number</Label>
            <Input id="contact" name="contact" type="tel" autoComplete="tel" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="8+ characters"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="setupSecret">One-time setup secret</Label>
            <Input
              id="setupSecret"
              name="setupSecret"
              type="password"
              autoComplete="off"
              minLength={24}
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full rounded-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Create Management account"}
          </Button>
        </form>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Keep the setup secret private. After this account is created, remove the setup secret from
          your hosting environment immediately.
        </p>
      </section>
    </main>
  );
}
