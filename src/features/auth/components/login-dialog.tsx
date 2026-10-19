import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Leaf, LockKeyhole, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthSwitchLink } from "@/features/auth/components/auth-switch-link";
import { loginUser } from "@/services/auth/auth-functions";

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegister?: () => void;
};

function destinationForRoles(roles: string[]) {
  const role = roles[0] ?? "Buyer";
  return role === "Management"
    ? "/management"
    : role === "Marketer"
      ? "/marketer"
      : role === "Accounting"
        ? "/accounting"
        : role === "Farmer"
          ? "/farmer"
          : role === "Farm Consultant"
            ? "/consultant"
            : "/";
}

export function LoginDialog({ open, onOpenChange, onRegister }: LoginDialogProps) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[2rem] border-primary/25 p-0 shadow-field sm:max-w-md">
        <div className="h-2 bg-primary" />
        <div className="px-6 pb-7 pt-4 sm:px-9 sm:pb-9">
          <DialogHeader className="items-center pt-2 text-center sm:text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl surface-sprout shadow-sm">
              <Leaf className="size-7" />
            </span>
            <p className="pt-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              AgriLink
            </p>
            <DialogTitle className="pt-1 text-2xl">Welcome back</DialogTitle>
            <DialogDescription className="max-w-xs pt-1 text-center">
              Sign in to access the AgriLink workspace assigned to your account.
            </DialogDescription>
          </DialogHeader>

          <form
            className="mt-7 space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              setIsSigningIn(true);
              try {
                const signedIn = await loginUser({
                  data: {
                    identifier: String(formData.get("identifier") ?? ""),
                    password: String(formData.get("password") ?? ""),
                  },
                });
                onOpenChange(false);
                toast.success(`Welcome back, ${signedIn.displayName}`, {
                  description: "You are signed in with your AgriLink account.",
                });
                navigate({ to: destinationForRoles(signedIn.roles) });
              } catch (error) {
                toast.error("Invalid credentials", {
                  description:
                    error instanceof Error
                      ? error.message
                      : "Please check your account information and try again.",
                });
              } finally {
                setIsSigningIn(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="landing-login-identifier">Username or email</Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="landing-login-identifier"
                  name="identifier"
                  autoComplete="username"
                  placeholder="Username or email"
                  required
                  className="h-12 pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="landing-login-password">Password</Label>
                <AuthSwitchLink
                  to="/forgot-password"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Forgot password?
                </AuthSwitchLink>
              </div>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="landing-login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  className="h-12 px-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full rounded-full" disabled={isSigningIn}>
              {isSigningIn ? "Signing in…" : "Login"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New buyer?{" "}
            {onRegister ? (
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => {
                  onOpenChange(false);
                  onRegister();
                }}
              >
                Register as Buyer
              </button>
            ) : (
              <AuthSwitchLink to="/register" className="font-semibold text-primary hover:underline">
                Register as Buyer
              </AuthSwitchLink>
            )}
          </p>
          <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
            Management, Marketer, Accounting, Farmer, and Consultant accounts are created by
            Management.
          </p>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Authorized AgriLink users only.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
