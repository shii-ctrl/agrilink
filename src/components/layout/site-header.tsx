import { Link } from "@tanstack/react-router";
import { LogOut, Menu, ShoppingBag, ShoppingCart, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogoutConfirmation } from "@/components/layout/logout-confirmation";
import { ProcyLogo } from "@/components/layout/procy-logo";
import { LoginDialog } from "@/features/auth/components/login-dialog";
import { PasswordResetDialog } from "@/features/auth/components/password-reset-dialog";
import { RegisterDialog } from "@/features/auth/components/register-dialog";
import { getCurrentSessionUser, logoutUser } from "@/services/auth/auth-functions";
import { buyerCartChangedEvent } from "@/features/marketplace/cart-events";
import { authSessionChangedEvent } from "@/lib/auth/session-events";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
};

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
}: {
  dark?: boolean;
  onLogin?: () => void;
  onRegister?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<SessionAccount | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  useEffect(() => {
    let mounted = true;
    const loadAccount = () => {
      void getCurrentSessionUser()
        .then((user) => {
          if (mounted) setAccount(user);
        })
        .catch(() => {
          if (mounted) setAccount(null);
        });
    };
    loadAccount();
    window.addEventListener(authSessionChangedEvent, loadAccount);
    return () => {
      mounted = false;
      window.removeEventListener(authSessionChangedEvent, loadAccount);
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
        <div className="mx-auto flex h-[5.75rem] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full surface-sprout">
              <ProcyLogo className="size-8" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">AgriLink</span>
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
            <span className={dark ? "[&>button]:text-forest-foreground" : undefined}>
              <ThemeToggle />
            </span>
            {isBuyer ? (
              <>
                <BuyerCartButton dark={dark} />
                <BuyerDrawer account={account!} onSignOut={() => setAccount(null)} />
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
                  Register as Buyer
                </Button>
              </>
            )}
          </div>

          <button
            className={`inline-flex size-10 items-center justify-center rounded-full border transition-all lg:hidden ${menuButton}`}
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {open && (
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
                <span className={dark ? "[&>button]:text-forest-foreground" : undefined}>
                  <ThemeToggle />
                </span>
                {isBuyer ? (
                  <>
                    <BuyerCartButton dark={dark} />
                    <BuyerDrawer
                      account={account!}
                      onSignOut={() => {
                        setAccount(null);
                        setOpen(false);
                      }}
                    />
                  </>
                ) : workspace ? (
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

function BuyerCartButton({ dark }: { dark: boolean }) {
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const loadCount = () => {
      void import("@/services/marketplace/marketplace-server-functions")
        .then(({ getBuyerCart }) => getBuyerCart())
        .then((items) => {
          if (mounted) setItemCount(items.length);
        })
        .catch(() => {
          // The cart page will show a more useful message if loading fails.
        });
    };
    loadCount();
    window.addEventListener(buyerCartChangedEvent, loadCount);
    window.addEventListener("focus", loadCount);
    return () => {
      mounted = false;
      window.removeEventListener(buyerCartChangedEvent, loadCount);
      window.removeEventListener("focus", loadCount);
    };
  }, []);

  return (
    <Link
      to="/buyer/cart"
      aria-label={itemCount ? `Open cart with ${itemCount} item groups` : "Open cart"}
      className={`relative inline-flex size-9 items-center justify-center rounded-full border transition-colors ${
        dark
          ? "border-white/20 text-forest-foreground hover:bg-white/10"
          : "border-border text-foreground hover:bg-accent"
      }`}
    >
      <ShoppingCart className="size-4" />
      {itemCount > 0 && (
        <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </Link>
  );
}

function BuyerDrawer({ account, onSignOut }: { account: SessionAccount; onSignOut: () => void }) {
  const name = account.displayName ?? account.username;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" className="rounded-full">
          <UserRound className="size-4" /> {name}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[min(86vw,22rem)] flex-col p-5">
        <SheetHeader>
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <SheetTitle className="mt-4">{name}</SheetTitle>
          <SheetDescription>Buyer account · signed in</SheetDescription>
        </SheetHeader>
        <nav className="mt-8 space-y-2">
          <SheetClose asChild>
            <Link
              to="/buyer/profile"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium hover:bg-accent"
            >
              <UserRound className="size-4 text-primary" /> My profile
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              to="/buyer/cart"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium hover:bg-accent"
            >
              <ShoppingCart className="size-4 text-primary" /> My cart
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              to="/buyer/orders"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium hover:bg-accent"
            >
              <ShoppingBag className="size-4 text-primary" /> My orders
            </Link>
          </SheetClose>
        </nav>
        <div className="mt-auto border-t pt-4">
          <LogoutConfirmation
            onConfirm={async () => {
              await logoutUser();
              onSignOut();
            }}
          >
            <Button
              variant="ghost"
              className="w-full justify-start rounded-xl text-destructive hover:text-destructive"
            >
              <LogOut className="size-4" /> Log out
            </Button>
          </LogoutConfirmation>
        </div>
      </SheetContent>
    </Sheet>
  );
}
