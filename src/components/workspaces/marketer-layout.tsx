import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  CircleAlert,
  LogOut,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  Settings,
  ShoppingBag,
  Tag,
} from "lucide-react";
import type { ReactNode } from "react";

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

const marketerSections = [
  { title: "Main", items: [{ title: "Dashboard", to: "/marketer", icon: BarChart3 }] },
  {
    title: "Product workflow",
    items: [
      { title: "Product Catalog", to: "/marketer/products", icon: ShoppingBag },
      { title: "Record Stock", to: "/marketer/receiving", icon: ReceiptText },
      { title: "Stock Records", to: "/marketer/classification", icon: PackageCheck },
    ],
  },
  {
    title: "Marketplace",
    items: [{ title: "Daily Prices & Deals", to: "/marketer/daily-prices", icon: Tag }],
  },
  {
    title: "Operations",
    items: [
      { title: "Orders", to: "/marketer/orders", icon: ClipboardCheck },
      { title: "Delivery Issues", to: "/marketer/disputes", icon: CircleAlert },
      { title: "Sales Monitoring", to: "/marketer/sales", icon: Boxes },
    ],
  },
  {
    title: "Collaboration",
    items: [{ title: "Community", to: "/marketer/community", icon: MessageCircle }],
  },
] as const;

export function MarketerLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const marketer = useWorkspaceUser("Marketer");
  return (
    <RoleGate role="Marketer">
      <SidebarProvider>
        <Sidebar collapsible="offcanvas" className="border-r border-border/70">
          <SidebarHeader className="p-4">
            <Link to="/" className="flex items-center gap-2.5 px-2 py-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <ProcyLogo className="size-8" />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold leading-none text-foreground">
                  AgriLink
                </span>
                <span className="mt-1 block text-xs text-sidebar-foreground/65">Marketer</span>
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            {marketerSections.map((section) => (
              <SidebarGroup key={section.title}>
                <details open>
                  <summary className="cursor-pointer list-none">
                    <SidebarGroupLabel className="flex items-center justify-between">
                      {section.title}
                      <span className="text-xs">⌄</span>
                    </SidebarGroupLabel>
                  </summary>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            tooltip={item.title}
                            isActive={pathname === item.to}
                          >
                            <Link to={item.to} activeOptions={{ exact: true }}>
                              <item.icon />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </details>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter className="p-3">
            <div className="mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarImage
                    src={marketer.avatarUrl ?? undefined}
                    alt={`${marketer.displayName} profile photo`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                    {marketer.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{marketer.displayName}</p>
                  <p className="truncate text-xs text-sidebar-foreground/65">Marketer</p>
                </div>
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Profile"
                  isActive={pathname === "/marketer/profile"}
                >
                  <Link to="/marketer/profile">
                    <Settings />
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
                  <SidebarMenuButton tooltip="Log out">
                    <LogOut />
                    <span>Log out</span>
                  </SidebarMenuButton>
                </LogoutConfirmation>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <main className="min-h-svh flex-1 bg-muted/30">{children}</main>
      </SidebarProvider>
    </RoleGate>
  );
}

export function MarketerPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 px-4 py-4 backdrop-blur md:static sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <SidebarTrigger className="mt-0.5" />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Marketer</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        <WorkspaceHeaderActions role="Marketer" />
      </div>
    </header>
  );
}
