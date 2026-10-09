import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, Leaf } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import heroImg from "@/assets/hero-farm.jpg";
import { AuthSwitchLink } from "@/components/auth-switch-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePasswordReset, requestPasswordResetCode } from "@/lib/auth-functions";
import { minimumPasswordLength, passwordHelpText } from "@/lib/password-requirements";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset Password — AgriLink" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
        description: "Enter the same password in both new-password fields.",
      });
      return;
    }
    setSubmitting(true);
    try {
      await completePasswordReset({
        data: { email, code, newPassword },
      });
      toast.success("Password reset", {
        description: "Your new password is ready. Please sign in again.",
      });
      navigate({ to: "/login" });
    } catch (error) {
      toast.error("Could not reset password", {
        description: error instanceof Error ? error.message : "Check the code and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

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
          <h1 className="mt-5 text-3xl font-semibold">Reset your password</h1>
          {!codeSent ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter the email saved on your AgriLink account. We will send a 6-digit code that
                expires in 10 minutes.
              </p>
              <form className="mt-7 space-y-4" onSubmit={requestCode}>
                <div className="space-y-2">
                  <Label htmlFor="email">Account email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    className="h-11"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-full"
                  disabled={submitting}
                >
                  {submitting ? "Sending code…" : "Email me a code"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter the 6-digit code sent to{" "}
                <span className="font-medium text-foreground">{email}</span>, then choose a new
                password with at least 12 characters.
              </p>
              <form className="mt-7 space-y-4" onSubmit={resetPassword}>
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
                    className="h-11 tracking-[0.3em]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={minimumPasswordLength}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={minimumPasswordLength}
                    required
                    className="h-11"
                  />
                </div>
                <p className="text-xs text-muted-foreground">{passwordHelpText}</p>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-full"
                  disabled={submitting}
                >
                  {submitting ? "Resetting password…" : "Reset password"}
                </Button>
              </form>
              <button
                type="button"
                className="mt-4 text-sm font-medium text-primary hover:underline"
                onClick={() => {
                  setCode("");
                  setCodeSent(false);
                }}
              >
                Use a different email
              </button>
            </>
          )}
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
          Secure access recovery for AgriLink account holders.
        </p>
      </div>
    </div>
  );
}
