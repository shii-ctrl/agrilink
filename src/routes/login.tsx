import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Leaf } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import heroImg from "@/assets/hero-farm.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthSwitchLink } from "@/components/auth-switch-link";
import { loginUser } from "@/lib/auth-functions";
import { setSessionView } from "@/lib/demo-session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — AgriLink" },
      {
        name: "description",
        content:
          "Sign in to AgriLink to access your marketplace orders, production records, or role dashboard.",
      },
      { property: "og:title", content: "Login — AgriLink" },
      { property: "og:description", content: "Sign in to your AgriLink account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="auth-panel-enter-left flex flex-col justify-center px-6 py-16 sm:px-16">
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
          <h1 className="text-3xl font-semibold">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use your AgriLink username or email and password to access the area assigned to your
            account.
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              try {
                const signedIn = await loginUser({
                  data: {
                    identifier: String(formData.get("identifier") ?? ""),
                    password: String(formData.get("password") ?? ""),
                  },
                });
                const role = signedIn.roles[0] ?? "Buyer";
                setSessionView({
                  username: signedIn.username,
                  role,
                  displayName: signedIn.displayName,
                });
                toast(`Welcome back, ${signedIn.displayName}`, {
                  description: "You are signed in with your AgriLink account.",
                });
                navigate({
                  to:
                    role === "Management"
                      ? "/management"
                      : role === "Marketer"
                        ? "/marketer"
                        : role === "Accounting"
                          ? "/accounting"
                          : role === "Farmer"
                            ? "/farmer"
                            : role === "Farm Consultant"
                              ? "/consultant"
                              : "/",
                });
              } catch (error) {
                toast("Invalid credentials", {
                  description:
                    error instanceof Error
                      ? error.message
                      : "Please check your account information and try again.",
                });
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="identifier">Username or email</Label>
              <Input
                id="identifier"
                name="identifier"
                autoComplete="username"
                placeholder="Username or email"
                required
                className="h-11"
              />
              <div className="text-right">
                <AuthSwitchLink
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </AuthSwitchLink>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                className="h-11"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                />{" "}
                Show password
              </label>
            </div>
            <Button type="submit" size="lg" className="w-full rounded-full">
              Login
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            New buyer?{" "}
            <AuthSwitchLink to="/register" className="font-medium text-primary hover:underline">
              Register as Buyer
            </AuthSwitchLink>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Management, Marketer, Accounting, Farmer, and Consultant accounts are created by
            Management.
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
          Browse agricultural products supplied by local farmer members and managed by PROCY.
        </p>
      </div>
    </div>
  );
}
