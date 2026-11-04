import { useNavigate, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/ui/toast";

import { Button } from "@/components/ui/button";
import { ProcyLogo } from "@/components/layout/procy-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { minimumPasswordLength, passwordHelpText } from "@/features/auth/password-requirements";
import { registerBuyer } from "@/services/auth/auth-functions";
import { setSessionView } from "@/lib/auth/session-view";
import { notifyAuthSessionChanged } from "@/lib/auth/session-events";

type RegisterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin?: () => void;
};

export function RegisterDialog({ open, onOpenChange, onLogin }: RegisterDialogProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%_-_0.75rem)] max-h-[calc(100dvh_-_0.75rem)] overflow-hidden overscroll-contain rounded-[1.5rem] border-primary/25 bg-card p-0 text-card-foreground shadow-field sm:max-w-md sm:rounded-[2rem]">
        <div className="h-2 bg-primary" />
        <div className="min-h-0 touch-pan-y overflow-y-auto px-6 pb-7 pt-4 [scrollbar-width:none] sm:px-9 sm:pb-9 [&::-webkit-scrollbar]:hidden">
          <DialogHeader className="items-center bg-card/95 pr-0 pt-2 text-center sm:pr-0 sm:text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl surface-sprout shadow-sm">
              <ProcyLogo className="size-12" />
            </span>
            <p className="pt-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              AgriLink
            </p>
            <DialogTitle className="pt-1 text-2xl">Create a Buyer account</DialogTitle>
            <DialogDescription className="max-w-xs pt-1 text-center">
              Choose a username and password to start adding products to your cart.
            </DialogDescription>
          </DialogHeader>

          <form
            className="mt-7 space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const password = String(formData.get("password") ?? "");
              if (password !== String(formData.get("confirm") ?? "")) {
                toast.error("Passwords do not match", {
                  description: "Enter the same password in both fields.",
                });
                return;
              }
              setIsCreating(true);
              try {
                const signedIn = await registerBuyer({
                  data: {
                    username: String(formData.get("username") ?? ""),
                    password,
                  },
                });
                setSessionView({
                  username: signedIn.username,
                  role: "Buyer",
                  displayName: signedIn.displayName,
                });
                notifyAuthSessionChanged();
                await router.invalidate();
                onOpenChange(false);
                toast.success("Buyer account created", {
                  description: "Your AgriLink account is ready to use.",
                });
                navigate({ to: "/", replace: true });
              } catch (error) {
                toast.error("Unable to create account", {
                  description: error instanceof Error ? error.message : "Please try again.",
                });
              } finally {
                setIsCreating(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="landing-register-username">Username</Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="landing-register-username"
                  name="username"
                  autoComplete="username"
                  minLength={3}
                  maxLength={120}
                  pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
                  placeholder="Choose a username"
                  required
                  className="auth-login-field h-12 border-border bg-background pl-10 text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use letters, numbers, periods, underscores, or hyphens.
              </p>
            </div>
            <PasswordField
              id="landing-register-password"
              label="Password"
              name="password"
              showPassword={showPassword}
              onToggle={() => setShowPassword((visible) => !visible)}
            />
            <div className="space-y-2">
              <Label htmlFor="landing-register-confirm">Confirm password</Label>
              <Input
                id="landing-register-confirm"
                name="confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={minimumPasswordLength}
                placeholder="Re-enter your password"
                required
                className="auth-login-field h-12 border-border bg-background text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">{passwordHelpText}</p>
            </div>
            <Button type="submit" size="lg" className="w-full rounded-full" disabled={isCreating}>
              {isCreating ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            {onLogin ? (
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => {
                  onOpenChange(false);
                  onLogin();
                }}
              >
                Login
              </button>
            ) : (
              "Visit the login page."
            )}
          </p>
          <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
            Username-only Buyer accounts do not have email password recovery. Contact Management if
            you need your password reset.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PasswordField({
  id,
  label,
  name,
  showPassword,
  onToggle,
}: {
  id: string;
  label: string;
  name: string;
  showPassword: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          minLength={minimumPasswordLength}
          placeholder="At least 8 characters"
          required
          className="auth-login-field h-12 border-border bg-background px-10 text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
