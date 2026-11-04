import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CircleDollarSign,
  FileBarChart,
  HandCoins,
  Landmark,
  LockKeyhole,
  LogOut,
  MessageCircle,
  ReceiptText,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";

import { signOutCurrentAccount } from "@/lib/auth/session-view";
import { RoleGate } from "@/components/layout/role-gate";
import { LogoutConfirmation } from "@/components/layout/logout-confirmation";
import { ProcyLogo } from "@/components/layout/procy-logo";
import { NotificationCenter } from "@/features/messaging/components/notification-center";
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

const navigation = [
  { label: "Dashboard", to: "/accounting", icon: BarChart3 },
  { label: "Transactions", to: "/accounting/transactions", icon: ReceiptText },
  { label: "Record Payment", to: "/accounting/payments", icon: CircleDollarSign },
  { label: "Farmer Payouts", to: "/accounting/farmer-payouts", icon: Landmark },
  { label: "Delivery Refunds", to: "/accounting/refunds", icon: HandCoins },
  { label: "Daily Closing", to: "/accounting/daily-closing", icon: LockKeyhole },
  { label: "Reports", to: "/accounting/reports", icon: FileBarChart },
  { label: "Community", to: "/accounting/community", icon: MessageCircle },
] as const;

export function AccountingLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const accountant = useWorkspaceUser("Accounting");
  return (
    <RoleGate role="Accounting">
      <SidebarProvider>
        <Sidebar collapsible="offcanvas" className="border-r border-border/70">
          <SidebarHeader className="p-4">
            <Link to="/" className="flex items-center gap-2 rounded-lg px-2 py-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-lime text-forest">
                <ProcyLogo className="size-8" />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold">AgriLink</span>
                <span className="block text-xs text-sidebar-foreground/65">Accounting</span>
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Main</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={pathname === item.to}
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
                    src={accountant.avatarUrl ?? undefined}
                    alt={`${accountant.displayName} profile photo`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                    {accountant.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{accountant.displayName}</p>
                  <p className="text-xs text-sidebar-foreground/65">Accounting</p>
                </div>
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Profile"
                  isActive={pathname === "/accounting/profile"}
                >
                  <Link to="/accounting/profile">
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
                  <SidebarMenuButton tooltip="Logout">
                    <LogOut />
                    <span>Logout</span>
                  </SidebarMenuButton>
                </LogoutConfirmation>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="min-w-0 flex-1 bg-background">{children}</div>
      </SidebarProvider>
    </RoleGate>
  );
}

export function AccountingPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-start gap-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur md:static md:px-8">
      <SidebarTrigger className="mt-1" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Accounting</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="ml-auto">
        <NotificationCenter role="Accounting" />
      </div>
    </header>
  );
}
