import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, LockKeyhole } from "lucide-react";
import { useState } from "react";
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
import { minimumPasswordLength, passwordHelpText } from "@/features/auth/password-requirements";
import { completePasswordReset, requestPasswordResetCode } from "@/services/auth/auth-functions";

type PasswordResetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin?: () => void;
};

export function PasswordResetDialog({ open, onOpenChange, onLogin }: PasswordResetDialogProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setCode("");
    setCodeSent(false);
    onOpenChange(false);
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await requestPasswordResetCode({ data: { email } });
      setCode("");
      setCodeSent(true);
      toast.success("Check your email", {
        description: "If that email belongs to an active account, a 6-digit reset code was sent.",
      });
    } catch (error) {
      toast.error("Could not send a reset code", {
        description: error instanceof Error ? error.message : "Please try again later.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    if (newPassword !== String(formData.get("confirmPassword") ?? "")) {
      toast.error("Passwords do not match", {
        description: "Enter the same password in both fields.",
      });
      return;
    }
    setSubmitting(true);
    try {
      await completePasswordReset({ data: { email, code, newPassword } });
      close();
      toast.success("Password reset", {
        description: "Your new password is ready. Please sign in again.",
      });
      if (onLogin) onLogin();
      else navigate({ to: "/login" });
    } catch (error) {
      toast.error("Could not reset password", {
        description: error instanceof Error ? error.message : "Check the code and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[2rem] border-primary/25 p-0 shadow-field sm:max-w-md">
        <div className="h-2 bg-primary" />
        <div className="px-6 pb-7 pt-4 sm:px-9 sm:pb-9">
          <DialogHeader className="items-center pt-2 text-center sm:text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl surface-sprout shadow-sm">
              <ProcyLogo className="size-12" />
            </span>
            <p className="pt-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              AgriLink
            </p>
            <DialogTitle className="flex items-center gap-2 pt-1 text-2xl">
              <KeyRound className="size-5 text-primary" /> Reset your password
            </DialogTitle>
            <DialogDescription className="max-w-xs pt-1 text-center">
              {codeSent
                ? "Enter the code from your email, then create a new password."
                : "Use the email saved on your existing AgriLink account."}
            </DialogDescription>
          </DialogHeader>

          {!codeSent ? (
            <form className="mt-7 space-y-5" onSubmit={requestCode}>
              <div className="space-y-2">
                <Label htmlFor="reset-email">Account email</Label>
                <Input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-12"
                />
              </div>
              <Button type="submit" size="lg" className="w-full rounded-full" disabled={submitting}>
                {submitting ? "Sending code…" : "Email me a code"}
              </Button>
            </form>
          ) : (
            <form className="mt-7 space-y-5" onSubmit={resetPassword}>
              <div className="space-y-2">
                <Label htmlFor="reset-code">6-digit code</Label>
                <Input
                  id="reset-code"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  required
                  className="h-12 tracking-[0.3em]"
                />
              </div>
              <PasswordInput
                id="reset-new-password"
                label="New password"
                name="newPassword"
                showPassword={showPassword}
                onToggle={() => setShowPassword((visible) => !visible)}
              />
              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">Confirm new password</Label>
                <Input
                  id="reset-confirm-password"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={minimumPasswordLength}
                  required
                  className="h-12"
                />
                <p className="text-xs text-muted-foreground">{passwordHelpText}</p>
              </div>
              <Button type="submit" size="lg" className="w-full rounded-full" disabled={submitting}>
                {submitting ? "Resetting password…" : "Reset password"}
              </Button>
              <button
                type="button"
                className="w-full text-sm font-semibold text-primary hover:underline"
                onClick={() => {
                  setCode("");
                  setCodeSent(false);
                }}
              >
                Use a different email
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            Username-only Buyer accounts do not have email password recovery. Contact Management for
            a password reset.
          </p>
          {onLogin && (
            <button
              type="button"
              className="mt-3 w-full text-sm font-semibold text-primary hover:underline"
              onClick={() => {
                close();
                onLogin();
              }}
            >
              Back to Login
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PasswordInput({
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
          required
          className="h-12 px-10"
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
