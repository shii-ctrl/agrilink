import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, Leaf } from "lucide-react";
import heroImg from "@/assets/hero-farm.jpg";
import { AuthSwitchLink } from "@/components/auth-switch-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot Password — AgriLink" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="auth-panel-enter-left flex flex-col justify-center px-6 py-16 sm:px-16">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full surface-sprout">
            <Leaf className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">AgriLink</span>
        </Link>
        <div className="mt-12 max-w-sm">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <KeyRound className="size-5" />
          </span>
          <h1 className="mt-5 text-3xl font-semibold">Forgot your password?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Password-reset email delivery is not configured for this installation yet. Contact an
            AgriLink administrator to reset your account securely.
          </p>
          <form className="mt-8 space-y-4" onSubmit={(event) => event.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                disabled
                className="h-11"
              />
            </div>
            <Button type="submit" size="lg" className="w-full rounded-full" disabled>
              Reset delivery unavailable
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            Remembered it?{" "}
            <AuthSwitchLink to="/login" className="font-medium text-primary hover:underline">
              Back to Login
            </AuthSwitchLink>
          </p>
        </div>
      </div>
      <div className="auth-visual-enter-right relative hidden lg:block">
        <img
          src={heroImg}
          alt="Terraced vegetable farm at sunrise"
          width={1600}
          height={1008}
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest/90 to-forest/20" />
        <p className="absolute bottom-12 left-12 max-w-sm font-display text-2xl font-semibold text-forest-foreground">
          Account recovery is intentionally unavailable until a secure email delivery provider is
          configured.
        </p>
      </div>
    </div>
  );
}
