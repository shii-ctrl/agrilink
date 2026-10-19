import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Leaf, LockKeyhole, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import heroImg from "@/assets/hero-farm.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthSwitchLink } from "@/features/auth/components/auth-switch-link";
import { registerBuyer } from "@/services/auth/auth-functions";
import { minimumPasswordLength, passwordHelpText } from "@/features/auth/password-requirements";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register as Buyer — AgriLink" },
      {
        name: "description",
        content:
          "Create a buyer account to add products to your cart, checkout, and place orders with PROCY on AgriLink.",
      },
      { property: "og:title", content: "Register as Buyer — AgriLink" },
      {
        property: "og:description",
        content: "Create a buyer account to place orders with PROCY.",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const passwordStatus =
    password.length >= minimumPasswordLength ? "Ready" : password ? "Too short" : "";
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="auth-visual-enter-left relative hidden lg:block">
        <img
          src={heroImg}
          alt="Terraced vegetable farm at sunrise"
          width={1600}
          height={1008}
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest/90 to-forest/20" />
        <p className="absolute bottom-12 left-12 max-w-sm font-display text-2xl font-semibold text-forest-foreground">
          Buyers purchase from PROCY — the seller and market operator of AgriLink.
        </p>
      </div>

      <div className="auth-panel-enter-right flex flex-col justify-center px-6 py-16 sm:px-16">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full surface-sprout">
            <Leaf className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">AgriLink</span>
        </Link>
        <Link
          to="/"
          className="mt-8 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Home
        </Link>

        <div className="mt-8 max-w-sm">
          <h1 className="text-3xl font-semibold">Register as Buyer</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a username and password. Only buyer accounts can self-register.
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              if (formData.get("password") !== formData.get("confirm")) {
                toast("Passwords do not match", {
                  description: "Enter the same password in both password fields.",
                });
                return;
              }
              const password = String(formData.get("password") ?? "");
              try {
                await registerBuyer({
                  data: {
                    username: String(formData.get("username") ?? ""),
                    password,
                  },
                });
                toast("Buyer account created", {
                  description: "Your account is now saved in AgriLink.",
                });
                navigate({ to: "/" });
              } catch (error) {
                toast("Unable to create account", {
                  description: error instanceof Error ? error.message : "Please try again.",
                });
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  minLength={3}
                  maxLength={120}
                  pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
                  placeholder="Choose a username"
                  required
                  className="h-11 pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use letters, numbers, periods, underscores, or hyphens.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={minimumPasswordLength}
                    placeholder="At least 8 characters"
                    required
                    className="h-11 px-10"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {passwordStatus && (
                  <p
                    className={`text-xs ${passwordStatus === "Ready" ? "text-good" : "text-reject"}`}
                  >
                    Password: {passwordStatus}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={minimumPasswordLength}
                  placeholder="Re-enter your password"
                  required
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">{passwordHelpText}</p>
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full rounded-full">
              Create account
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            Already registered?{" "}
            <AuthSwitchLink to="/login" className="font-medium text-primary hover:underline">
              Login
            </AuthSwitchLink>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Username-only Buyer accounts need Management assistance if their password is lost.
          </p>
        </div>
      </div>
    </div>
  );
}
