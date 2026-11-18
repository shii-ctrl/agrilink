import { useNavigate, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/ui/toast";
import { userFacingErrorMessage } from "@/lib/ui/user-facing-error";

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
import { registerFarmer } from "@/services/auth/farmer-application-server-functions";
import { setSessionView } from "@/lib/auth/session-view";
import { notifyAuthSessionChanged } from "@/lib/auth/session-events";

type RegisterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin?: () => void;
};

const usernamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const usernameHelp =
  "Do not use spaces. Use letters, numbers, periods, underscores, or hyphens only.";

function registrationErrorMessage(error: unknown) {
  const message = registrationErrorText(error);
  const invalidUsername =
    message.includes('"username"') ||
    message.includes("Use letters, numbers, periods, underscores, or hyphens only");
  const invalidPassword =
    message.includes('"password"') ||
    message.includes("Choose a password that is not commonly guessed") ||
    message.includes("Use at least 8 characters") ||
    message.includes("Password cannot start or end with a space");

  if (invalidUsername && invalidPassword) {
    return "Remove spaces or invalid characters from the username, and choose a stronger password that is not commonly guessed.";
  }
  if (invalidUsername) {
    return usernameHelp;
  }
  if (message.includes("Choose a password that is not commonly guessed")) {
    return "Choose a stronger password that is not commonly guessed.";
  }
  if (message.includes("Password cannot start or end with a space")) {
    return "The password cannot start or end with a space.";
  }
  if (invalidPassword) {
    return passwordHelpText;
  }
  if (/^\s*[[{]/.test(message) && message.includes('"path"')) {
    return "Please check your registration details, then try again.";
  }
  return userFacingErrorMessage(message, "Please check your details and try again.");
}

function registrationErrorText(value: unknown, depth = 0): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (!value || typeof value !== "object" || depth >= 4) return "";

  if (Array.isArray(value)) {
    return value.map((item) => registrationErrorText(item, depth + 1)).join(" ");
  }

  const details = value as Record<string, unknown>;
  const directMessage = registrationErrorText(details["message"], depth + 1);
  const nestedMessages = ["data", "cause", "error", "issues"]
    .map((key) => registrationErrorText(details[key], depth + 1))
    .filter(Boolean);
  return [directMessage, ...nestedMessages].filter(Boolean).join(" ");
}

export function RegisterDialog({ open, onOpenChange, onLogin }: RegisterDialogProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [accountType, setAccountType] = useState<"Buyer" | "Farmer">("Buyer");
  const [submittedFarmer, setSubmittedFarmer] = useState(false);
  useEffect(() => {
    if (!open) setSubmittedFarmer(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%_-_0.75rem)] max-h-[calc(100dvh_-_0.75rem)] touch-pan-y overflow-y-auto overscroll-contain rounded-[1.5rem] border-primary/25 bg-card p-0 text-card-foreground shadow-field sm:max-w-md sm:rounded-[2rem]">
        <div className="h-2 bg-primary" />
        <div className="min-h-0 px-6 pb-7 pt-4 sm:px-9 sm:pb-9">
          <DialogHeader className="static items-center bg-card/95 pr-0 pt-2 text-center sm:pr-0 sm:text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl surface-sprout shadow-sm">
              <ProcyLogo className="size-12" />
            </span>
            <p className="pt-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              AgriLink
            </p>
            <DialogTitle className="pt-1 text-2xl">
              {submittedFarmer
                ? "Application submitted"
                : accountType === "Farmer"
                  ? "Register as a Farmer"
                  : "Create a Buyer account"}
            </DialogTitle>
            <DialogDescription className="max-w-xs pt-1 text-center">
              {accountType === "Farmer"
                ? "Farmer registrations are reviewed by Management before workspace access is granted."
                : "Choose a username and password to start adding products to your cart."}
            </DialogDescription>
          </DialogHeader>

          {submittedFarmer && (
            <div
              className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm"
              role="status"
            >
              <p className="font-semibold">Pending Management approval</p>
              <p className="mt-2">
                Your Farmer application has been submitted. Sign in with your username and password
                to check its status. After approval, you can access the Farmer workspace.
              </p>
            </div>
          )}
          {!submittedFarmer && (
            <div className="mt-5 grid grid-cols-2 gap-2" aria-label="Account type">
              {(["Buyer", "Farmer"] as const).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={accountType === type ? "default" : "outline"}
                  aria-pressed={accountType === type}
                  disabled={isCreating}
                  onClick={() => setAccountType(type)}
                >
                  {type}
                </Button>
              ))}
            </div>
          )}
          <form
            className={submittedFarmer ? "hidden" : "mt-7 space-y-5"}
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const username = String(formData.get("username") ?? "").trim();
              const password = String(formData.get("password") ?? "");
              if (!usernamePattern.test(username)) {
                toast.error("Invalid username", { description: usernameHelp });
                return;
              }
              if (password !== String(formData.get("confirm") ?? "")) {
                toast.error("Passwords do not match", {
                  description: "Enter the same password in both fields.",
                });
                return;
              }
              setIsCreating(true);
              try {
                if (accountType === "Farmer") {
                  await registerFarmer({
                    data: {
                      username,
                      password,
                      name: String(formData.get("name") ?? ""),
                      contact: String(formData.get("contact") ?? ""),
                      farmingLocation: String(formData.get("farmingLocation") ?? ""),
                    },
                  });
                  setSubmittedFarmer(true);
                  return;
                }
                const signedIn = await registerBuyer({
                  data: {
                    username,
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
                  description: registrationErrorMessage(error),
                });
              } finally {
                setIsCreating(false);
              }
            }}
          >
            {accountType === "Farmer" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="farmer-register-name">Full name</Label>
                  <Input
                    id="farmer-register-name"
                    name="name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={160}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="farmer-register-contact">Contact number</Label>
                  <Input
                    id="farmer-register-contact"
                    name="contact"
                    type="tel"
                    autoComplete="tel"
                    placeholder="09XXXXXXXXX"
                    pattern="(09[0-9]{9}|\+639[0-9]{9}|639[0-9]{9})"
                    title="Enter a Philippine mobile number, such as 09123456789."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="farmer-register-location">Farming location</Label>
                  <Input
                    id="farmer-register-location"
                    name="farmingLocation"
                    autoComplete="street-address"
                    placeholder="Barangay, municipality, province"
                    minLength={5}
                    maxLength={500}
                    required
                  />
                </div>
              </>
            )}
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
                  title={usernameHelp}
                  onInvalid={(event) => {
                    if (!event.currentTarget.validity.patternMismatch) return;
                    event.preventDefault();
                    toast.error("Invalid username", { description: usernameHelp });
                  }}
                  placeholder="Choose a username"
                  required
                  className="auth-login-field h-12 border-border bg-background pl-10 text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                No spaces. Use letters, numbers, periods, underscores, or hyphens.
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
              {isCreating
                ? "Submitting…"
                : accountType === "Farmer"
                  ? "Submit Farmer application"
                  : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {submittedFarmer ? "Check your application status. " : "Already have an account? "}
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
          <p
            className={
              accountType === "Farmer"
                ? "hidden"
                : "mt-3 text-center text-xs leading-relaxed text-muted-foreground"
            }
          >
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
