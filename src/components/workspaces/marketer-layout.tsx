import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  Leaf,
  LogOut,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  Settings,
  ShoppingBag,
  Tag,
} from "lucide-react";
import type { ReactNode } from "react";

import { signOutDemoAccount } from "@/lib/demo/demo-session";
import { RoleGate } from "@/components/layout/role-gate";
import { NotificationCenter } from "@/features/messaging/components/notification-center";
import { useWorkspaceUser } from "@/hooks/use-workspace-user";
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
    title: "Marketplace",
    items: [
      { title: "Products", to: "/marketer/products", icon: ShoppingBag },
      { title: "Daily Prices & Deals", to: "/marketer/daily-prices", icon: Tag },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Product Receiving", to: "/marketer/receiving", icon: ReceiptText },
      { title: "Classification", to: "/marketer/classification", icon: PackageCheck },
      { title: "Orders", to: "/marketer/orders", icon: ClipboardCheck },
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
  const marketer = useWorkspaceUser("Marketer");
  return (
    <RoleGate role="Marketer">
      <SidebarProvider>
        <Sidebar collapsible="offcanvas" className="border-r border-border/70">
          <SidebarHeader className="p-4">
            <Link to="/" className="flex items-center gap-2.5 px-2 py-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Leaf className="size-5" />
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
                          <SidebarMenuButton asChild tooltip={item.title}>
                            <Link
                              to={item.to}
                              activeProps={{ className: "bg-primary/10 text-primary" }}
                            >
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
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {marketer.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{marketer.displayName}</p>
                  <p className="truncate text-xs text-sidebar-foreground/65">Marketer</p>
                </div>
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Profile">
                  <Link to="/marketer/profile">
                    <Settings />
                    <span>Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Log out"
                  onClick={async () => {
                    await signOutDemoAccount();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut />
                  <span>Log out</span>
                </SidebarMenuButton>
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
    <header className="border-b border-border/70 bg-background/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <SidebarTrigger className="mt-0.5" />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Marketer</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="ml-auto">
          <NotificationCenter role="Marketer" />
        </div>
      </div>
    </header>
  );
}
