import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ProcyLogo } from "@/components/layout/procy-logo";
import { ProfileAvatar } from "@/components/profile-avatar";
import { FloatingBuyerCartSummary } from "@/features/marketplace/components/floating-buyer-cart-summary";
import { LoginDialog } from "@/features/auth/components/login-dialog";
import { PasswordResetDialog } from "@/features/auth/components/password-reset-dialog";
import { RegisterDialog } from "@/features/auth/components/register-dialog";
import { getCurrentSessionUser } from "@/services/auth/auth-functions";
import { authSessionChangedEvent } from "@/lib/auth/session-events";
import { NotificationCenter } from "@/features/messaging/components/notification-center";

const nav = [
  { to: "/", label: "Home" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/daily-prices", label: "Daily Prices" },
  { to: "/help", label: "Help" },
  { to: "/about", label: "About" },
] as const;

type SessionAccount = {
  username: string;
  displayName: string;
  roles: string[];
  avatarUrl: string | null;
};

let cachedSessionAccount: SessionAccount | null | undefined;

const workspaceForRoles = [
  ["Management", "/management"],
  ["Marketer", "/marketer"],
  ["Accounting", "/accounting"],
  ["Farmer", "/farmer"],
  ["Rider", "/rider"],
] as const;

export function SiteHeader({
  dark = false,
  onLogin,
  onRegister,
  sessionAccount,
}: {
  dark?: boolean;
  onLogin?: () => void;
  onRegister?: () => void;
  sessionAccount?: SessionAccount | null;
}) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<SessionAccount | null>(
    sessionAccount !== undefined ? sessionAccount : (cachedSessionAccount ?? null),
  );
  const [sessionResolved, setSessionResolved] = useState(
    sessionAccount !== undefined || cachedSessionAccount !== undefined,
  );
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  useEffect(() => {
    if (sessionAccount !== undefined) {
      cachedSessionAccount = sessionAccount;
      setAccount(sessionAccount);
      setSessionResolved(true);
      return;
    }
    let mounted = true;
    const loadAccount = () => {
      void getCurrentSessionUser()
        .then((user) => {
          if (mounted) {
            cachedSessionAccount = user;
            setAccount(user);
            setSessionResolved(true);
          }
        })
        .catch(() => {
          if (mounted) {
            cachedSessionAccount = null;
            setAccount(null);
            setSessionResolved(true);
          }
        });
    };
    loadAccount();
    window.addEventListener(authSessionChangedEvent, loadAccount);
    return () => {
      mounted = false;
      window.removeEventListener(authSessionChangedEvent, loadAccount);
    };
  }, [sessionAccount]);
  useEffect(() => {
    const onProfileUpdated = (
      event: CustomEvent<{ displayName?: string; avatarUrl?: string | null }>,
    ) => {
      setAccount((current) => {
        if (!current) return current;
        const updated = {
          ...current,
          displayName: event.detail?.displayName ?? current.displayName,
          avatarUrl:
            typeof event.detail?.avatarUrl === "string" || event.detail?.avatarUrl === null
              ? event.detail.avatarUrl
              : current.avatarUrl,
        };
        cachedSessionAccount = updated;
        return updated;
      });
    };
    window.addEventListener("agrilink:profile-updated", onProfileUpdated as EventListener);
    return () => {
      window.removeEventListener("agrilink:profile-updated", onProfileUpdated as EventListener);
    };
  }, []);
  const workspace = account
    ? workspaceForRoles.find(([role]) => account.roles.includes(role))
    : undefined;
  const isBuyer = Boolean(account?.roles.includes("Buyer") && !workspace);
  const headerTone = dark
    ? "border-white/10 bg-forest/95 text-forest-foreground"
    : "border-border/60 bg-background/85";
  const subduedText = dark
    ? "text-forest-foreground/70 hover:bg-white/10 hover:text-forest-foreground"
    : "text-muted-foreground hover:bg-muted hover:text-foreground";
  const activeNav = dark
    ? "bg-white/15 text-forest-foreground"
    : "bg-accent text-accent-foreground";
  const menuButton = dark
    ? "border-white/20 text-forest-foreground hover:bg-white/10"
    : "border-border hover:bg-accent";

  return (
    <>
      <header className={`sticky top-0 z-50 border-b backdrop-blur ${headerTone}`}>
        <div className="flex h-16 w-full items-center justify-between gap-2 px-4 sm:h-[5.75rem] sm:gap-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full surface-sprout">
              <ProcyLogo className="size-8" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight sm:text-lg">
              AgriLink
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${subduedText}`}
                activeProps={{ className: activeNav }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {!account && (
              <span className={dark ? "[&>button]:text-forest-foreground" : undefined}>
                <ThemeToggle />
              </span>
            )}
            {!sessionResolved ? (
              <div className="h-9 w-28" aria-hidden="true" />
            ) : isBuyer ? (
              <>
                <NotificationCenter role="Buyer" />
                <Link
                  to="/buyer/profile"
                  className={`flex min-w-0 items-center gap-2 rounded-full p-1 pr-3 transition-colors ${
                    dark ? "hover:bg-white/10" : "hover:bg-accent"
                  }`}
                  aria-label="Open my profile"
                >
                  <ProfileAvatar
                    name={account!.displayName ?? account!.username}
                    avatarUrl={account!.avatarUrl}
                    className="size-9"
                    viewable={false}
                  />
                  <span className="max-w-36 truncate text-sm font-semibold">
                    {account!.displayName ?? account!.username}
                  </span>
                </Link>
              </>
            ) : workspace ? (
              <Button asChild size="sm" className="rounded-full">
                <Link to={workspace[1]}>Open workspace</Link>
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => (onLogin ? onLogin() : setLoginOpen(true))}
                  className={
                    dark
                      ? "text-forest-foreground hover:bg-white/10 hover:text-forest-foreground"
                      : undefined
                  }
                >
                  Login
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  onClick={() => (onRegister ? onRegister() : setRegisterOpen(true))}
                >
                  Register
                </Button>
              </>
            )}
          </div>

          {!sessionResolved ? (
            <div className="size-10" aria-hidden="true" />
          ) : isBuyer ? (
            <div className="flex items-center gap-1 lg:hidden">
              <Link
                to="/buyer"
                aria-label="Back to Buyer dashboard"
                className={`inline-flex size-9 items-center justify-center rounded-full border transition-colors ${menuButton}`}
              >
                <LayoutDashboard className="size-4" />
              </Link>
              <NotificationCenter role="Buyer" />
              <Link
                to="/buyer/profile"
                aria-label="Open my profile"
                className={`inline-flex size-9 items-center justify-center overflow-hidden rounded-full border transition-colors ${menuButton}`}
              >
                <ProfileAvatar
                  name={account!.displayName ?? account!.username}
                  avatarUrl={account!.avatarUrl}
                  className="size-full"
                  viewable={false}
                />
              </Link>
            </div>
          ) : (
            <button
              className={`inline-flex size-10 items-center justify-center rounded-full border transition-all lg:hidden ${menuButton}`}
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          )}
        </div>

        {open && !isBuyer && (
          <div
            className={`mobile-menu-enter border-t px-4 py-4 backdrop-blur-xl lg:hidden ${
              dark ? "border-white/10 bg-forest/95" : "border-border bg-background/95"
            }`}
          >
            <div
              className={`mx-auto flex max-w-md flex-col overflow-hidden rounded-2xl border shadow-card ${
                dark ? "border-white/15 bg-forest" : "border-border/70 bg-card"
              }`}
            >
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`mobile-menu-link border-b px-4 py-3 text-sm font-medium transition-colors last:border-b-0 ${
                    dark
                      ? "border-white/10 text-forest-foreground/75 hover:bg-white/10 hover:text-forest-foreground"
                      : "border-border/70 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div
                className={`mobile-menu-actions m-2 mt-3 flex items-center gap-2 border-t pt-3 ${
                  dark ? "border-white/10" : "border-border"
                }`}
              >
                {!account && (
                  <span className={dark ? "[&>button]:text-forest-foreground" : undefined}>
                    <ThemeToggle />
                  </span>
                )}
                {workspace ? (
                  <Button asChild size="sm" className="flex-1">
                    <Link to={workspace[1]} onClick={() => setOpen(false)}>
                      Open workspace
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                        if (onLogin) onLogin();
                        else setLoginOpen(true);
                      }}
                      className={`flex-1 ${
                        dark
                          ? "border-white/25 bg-transparent text-forest-foreground hover:bg-white/10 hover:text-forest-foreground"
                          : ""
                      }`}
                    >
                      Login
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setOpen(false);
                        if (onRegister) onRegister();
                        else setRegisterOpen(true);
                      }}
                    >
                      Register
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
      {isBuyer ? <FloatingBuyerCartSummary /> : null}
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onRegister={() => setRegisterOpen(true)}
        onForgotPassword={() => setPasswordResetOpen(true)}
      />
      <RegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onLogin={() => setLoginOpen(true)}
      />
      <PasswordResetDialog
        open={passwordResetOpen}
        onOpenChange={setPasswordResetOpen}
        onLogin={() => setLoginOpen(true)}
      />
    </>
  );
}
