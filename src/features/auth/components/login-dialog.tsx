import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
import { AuthSwitchLink } from "@/features/auth/components/auth-switch-link";
import { loginUser } from "@/services/auth/auth-functions";
import { setSessionView } from "@/lib/demo/demo-session";
import { notifyAuthSessionChanged } from "@/lib/auth/session-events";

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegister?: () => void;
  onForgotPassword?: () => void;
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
          : role === "Rider"
            ? "/rider"
            : "/";
}

export function LoginDialog({
  open,
  onOpenChange,
  onRegister,
  onForgotPassword,
}: LoginDialogProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [formFocused, setFormFocused] = useState(false);
  const blurTimer = useRef<number | null>(null);
  const [visibleViewport, setVisibleViewport] = useState<{
    height: number;
    offsetTop: number;
  } | null>(null);

  useEffect(() => {
    if (!open) setFormFocused(false);
    if (!open || typeof window === "undefined" || !window.visualViewport) {
      setVisibleViewport(null);
      return;
    }

    const viewport = window.visualViewport;
    const syncViewport = () => {
      if (!window.matchMedia("(max-width: 639px)").matches) {
        setVisibleViewport(null);
        return;
      }
      setVisibleViewport({
        height: Math.max(280, viewport.height),
        offsetTop: viewport.offsetTop,
      });
    };

    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    return () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%_-_0.75rem)] max-h-[calc(100dvh_-_0.75rem)] overflow-hidden overscroll-contain rounded-[1.5rem] border-primary/25 p-0 shadow-field sm:max-w-md sm:rounded-[2rem]"
        style={
          visibleViewport
            ? {
                maxHeight: `${Math.max(280, visibleViewport.height - 12)}px`,
                top: `${visibleViewport.offsetTop + visibleViewport.height / 2}px`,
              }
            : undefined
        }
      >
        <div className="h-2 bg-primary" />
        <div className="min-h-0 overflow-y-auto px-5 pb-6 pt-3 sm:px-9 sm:pb-9 sm:pt-4">
          <DialogHeader
            className={`text-center sm:text-center ${
              formFocused ? "items-start pt-0 text-left" : "items-center pt-2"
            }`}
          >
            <span
              className={`${formFocused ? "hidden" : "flex"} size-14 items-center justify-center rounded-2xl surface-sprout shadow-sm sm:flex`}
            >
              <ProcyLogo className="size-12" />
            </span>
            <p
              className={`${formFocused ? "hidden" : "block"} pt-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary sm:block`}
            >
              AgriLink
            </p>
            <DialogTitle className={`${formFocused ? "text-xl" : "pt-1 text-2xl"}`}>
              Welcome back
            </DialogTitle>
            <DialogDescription
              className={`${formFocused ? "hidden" : "block"} max-w-xs pt-1 text-center sm:block`}
            >
              Sign in to access the AgriLink workspace assigned to your account.
            </DialogDescription>
          </DialogHeader>

          <form
            className={`${formFocused ? "mt-3 space-y-3" : "mt-7 space-y-5"} sm:mt-7 sm:space-y-5`}
            onFocusCapture={(event) => {
              if (blurTimer.current !== null) {
                window.clearTimeout(blurTimer.current);
                blurTimer.current = null;
              }
              setFormFocused(true);
              const field = event.target;
              window.setTimeout(() => {
                if (field instanceof HTMLElement) {
                  field.scrollIntoView({ block: "center", behavior: "smooth" });
                }
              }, 180);
            }}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                blurTimer.current = window.setTimeout(() => {
                  setFormFocused(false);
                  blurTimer.current = null;
                }, 250);
              }
            }}
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
                setSessionView({
                  username: signedIn.username,
                  role: signedIn.roles[0] ?? "Buyer",
                  displayName: signedIn.displayName,
                });
                notifyAuthSessionChanged();
                await router.invalidate();
                onOpenChange(false);
                toast.success(`Welcome back, ${signedIn.displayName}`, {
                  description: "You are signed in with your AgriLink account.",
                });
                navigate({ to: destinationForRoles(signedIn.roles), replace: true });
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
                {onForgotPassword ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline"
                    onClick={() => {
                      onOpenChange(false);
                      onForgotPassword();
                    }}
                  >
                    Forgot password?
                  </button>
                ) : (
                  <AuthSwitchLink
                    to="/forgot-password"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </AuthSwitchLink>
                )}
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

          <p
            className={`${formFocused ? "hidden" : "block"} mt-6 text-center text-sm text-muted-foreground sm:block`}
          >
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
                Register
              </button>
            ) : (
              <AuthSwitchLink to="/register" className="font-semibold text-primary hover:underline">
                Register
              </AuthSwitchLink>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
