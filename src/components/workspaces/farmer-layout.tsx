import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  LogOut,
  MessageCircle,
  PackageCheck,
  Sprout,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { signOutDemoAccount } from "@/lib/demo/demo-session";
import { RoleGate } from "@/components/layout/role-gate";
import { LogoutConfirmation } from "@/components/layout/logout-confirmation";
import { ProcyLogo } from "@/components/layout/procy-logo";
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
const nav = [
  { label: "Dashboard", to: "/farmer", icon: Sprout },
  { label: "Production Records", to: "/farmer/production", icon: ClipboardList },
  { label: "Receiving History", to: "/farmer/receiving", icon: PackageCheck },
  { label: "Crop Guidance", to: "/farmer/guidance", icon: MessageCircle },
  { label: "Community", to: "/farmer/community", icon: MessageCircle },
] as const;
export function FarmerLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const farmer = useWorkspaceUser("Farmer");
  return (
    <RoleGate role="Farmer">
      <SidebarProvider>
        <Sidebar collapsible="offcanvas" className="border-r border-border/70">
          <SidebarHeader className="p-4">
            <Link to="/" className="flex items-center gap-2 rounded-lg px-2 py-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-lime text-forest">
                <ProcyLogo className="size-8" />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold">AgriLink</span>
                <span className="block text-xs text-sidebar-foreground/65">Farmer Member</span>
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
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {farmer.initials}
                </span>
                <div>
                  <p className="text-sm font-semibold">{farmer.displayName}</p>
                  <p className="text-xs text-sidebar-foreground/65">Farmer Member</p>
                </div>
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Profile"
                  isActive={pathname === "/farmer/profile"}
                >
                  <Link to="/farmer/profile">
                    <UserRound />
                    <span>Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <LogoutConfirmation
                  onConfirm={async () => {
                    await signOutDemoAccount();
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
export function FarmerPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="flex items-start gap-3 border-b border-border bg-background px-4 py-4 md:px-8">
      <SidebarTrigger className="mt-1" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Farmer Member
        </p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="ml-auto">
        <NotificationCenter role="Farmer" />
      </div>
    </header>
  );
}
