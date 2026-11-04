import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CircleAlert,
  LogOut,
  MessageCircle,
  ShoppingBag,
  ShoppingCart,
  Store,
  UserRound,
} from "lucide-react";
import { type ReactNode } from "react";
import { signOutCurrentAccount } from "@/lib/auth/session-view";
import { RoleGate } from "@/components/layout/role-gate";
import { LogoutConfirmation } from "@/components/layout/logout-confirmation";
import { ProcyLogo } from "@/components/layout/procy-logo";
import { WorkspaceHeaderActions } from "@/components/workspaces/workspace-header-actions";
import { useWorkspaceUser } from "@/hooks/use-workspace-user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const nav = [
  { label: "Browse Products", to: "/marketplace", icon: Store },
  { label: "My Cart", to: "/buyer/cart", icon: ShoppingCart },
  { label: "My Orders", to: "/buyer/orders", icon: ShoppingBag },
  { label: "Delivery Issues", to: "/buyer/issues", icon: CircleAlert },
  { label: "Messages", to: "/buyer/community", icon: MessageCircle },
] as const;
const mobileNav = [
  { label: "Shop", to: "/marketplace", icon: Store },
  { label: "Cart", to: "/buyer/cart", icon: ShoppingCart },
  { label: "Orders", to: "/buyer/orders", icon: ShoppingBag },
  { label: "Issues", to: "/buyer/issues", icon: CircleAlert },
  { label: "Messages", to: "/buyer/community", icon: MessageCircle },
  { label: "Profile", to: "/buyer/profile", icon: UserRound },
] as const;

function buyerNavIsActive(pathname: string, destination: string) {
  return pathname === destination;
}

export function BuyerLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const buyer = useWorkspaceUser("Buyer");
  return (
    <RoleGate role="Buyer">
      <SidebarProvider>
        <Sidebar collapsible="offcanvas" className="border-r border-border/70">
          <SidebarHeader className="p-4">
            <Link to="/" className="flex items-center gap-2 rounded-lg px-2 py-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-lime text-forest">
                <ProcyLogo className="size-8" />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold">AgriLink</span>
                <span className="block text-xs text-sidebar-foreground/65">Buyer</span>
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Main</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={buyerNavIsActive(pathname, item.to)}
                      >
                        <Link to={item.to} activeOptions={{ exact: true }}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <div className="mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarImage
                    src={buyer.avatarUrl ?? undefined}
                    alt={`${buyer.displayName} profile photo`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                    {buyer.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="max-w-36 truncate text-sm font-semibold">{buyer.displayName}</p>
                  <p className="text-xs text-sidebar-foreground/65">Buyer</p>
                </div>
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Profile"
                  isActive={pathname === "/buyer/profile"}
                >
                  <Link to="/buyer/profile">
                    <UserRound />
                    <span>Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <LogoutConfirmation
                  onConfirm={async () => {
                    await signOutCurrentAccount();
                    navigate({ to: "/" });
                  }}
                >
                  <SidebarMenuButton tooltip="Logout">
                    <LogOut />
                    <span>Logout</span>
                  </SidebarMenuButton>
                </LogoutConfirmation>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="min-w-0 flex-1 bg-background pb-24 md:pb-0">{children}</div>
        <nav
          aria-label="Buyer mobile navigation"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {mobileNav.map((item) => {
              const active = buyerNavIsActive(pathname, item.to);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  activeOptions={{ exact: true }}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-full ${active ? "bg-primary/12" : ""}`}
                  >
                    <item.icon className="size-5" />
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </SidebarProvider>
    </RoleGate>
  );
}
export function BuyerPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-start gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur md:static md:gap-3 md:px-8 md:py-4">
      <SidebarTrigger className="mt-0.5 size-9 shrink-0 md:mt-1" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Buyer</p>
        <h1 className="mt-0.5 truncate text-xl font-semibold sm:text-2xl md:mt-1 md:text-3xl">
          {title}
        </h1>
        <p className="mt-1 hidden max-w-2xl text-sm text-muted-foreground sm:block">
          {description}
        </p>
      </div>
      <WorkspaceHeaderActions role="Buyer" />
    </header>
  );
}
