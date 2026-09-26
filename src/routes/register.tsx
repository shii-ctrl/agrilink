import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Leaf } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import heroImg from "@/assets/hero-farm.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthSwitchLink } from "@/components/auth-switch-link";
import { registerBuyer } from "@/lib/auth-functions";
import { setSessionView } from "@/lib/demo-session";

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
  const passwordStatus = password.length >= 8 ? "Ready" : password ? "Too short" : "";
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
            Only buyer accounts can self-register. All other roles are created by Management.
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
              const email = String(formData.get("email") ?? "");
              const password = String(formData.get("password") ?? "");
              try {
                const account = await registerBuyer({
                  data: {
                    email,
                    password,
                    name: String(formData.get("name") ?? ""),
                    contact: String(formData.get("contact") ?? ""),
                  },
                });
                setSessionView({
                  username: account.username,
                  role: "Buyer",
                  displayName: account.displayName,
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
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Juan Dela Cruz"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact number</Label>
              <Input
                id="contact"
                name="contact"
                type="tel"
                autoComplete="tel"
                placeholder="0917 000 0000"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="juan@email.com"
                required
                className="h-11"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="At least 8 characters"
                  required
                  className="h-11"
                  onChange={(event) => setPassword(event.target.value)}
                />
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
                  minLength={8}
                  placeholder="Re-enter your password"
                  required
                  className="h-11"
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(event) => setShowPassword(event.target.checked)}
                  />{" "}
                  Show passwords
                </label>
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
            Your account is securely stored in AgriLink.
          </p>
        </div>
      </div>
    </div>
  );
}
