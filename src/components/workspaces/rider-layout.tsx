import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bike, CircleAlert, LogOut, MessageCircle, PackageCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { RoleGate } from "@/components/layout/role-gate";
import { LogoutConfirmation } from "@/components/layout/logout-confirmation";
import { ProcyLogo } from "@/components/layout/procy-logo";
import { WorkspaceHeaderActions } from "@/components/workspaces/workspace-header-actions";
import { CollapsibleSidebarGroup } from "@/components/workspaces/collapsible-sidebar-group";
import { SidebarCountBadge } from "@/components/workspaces/sidebar-count-badge";
import { useWorkspaceSidebarBadges } from "@/hooks/use-workspace-sidebar-badges";
import { useWorkspaceUser } from "@/hooks/use-workspace-user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOutCurrentAccount } from "@/lib/auth/session-view";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigation = [
  { label: "Delivery status", to: "/rider", icon: Bike },
  { label: "Completed deliveries", to: "/rider/completed", icon: PackageCheck },
  { label: "Delivery issues", to: "/rider/disputes", icon: CircleAlert },
  { label: "Messages", to: "/rider/community", icon: MessageCircle },
] as const;

export function RiderLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const rider = useWorkspaceUser("Rider");
  const badges = useWorkspaceSidebarBadges();

  return (
    <RoleGate role="Rider">
      <SidebarProvider>
        <Sidebar collapsible="offcanvas" className="border-r border-border/70">
          <SidebarHeader className="p-4">
            <Link to="/" className="flex items-center gap-2 rounded-lg px-2 py-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-lime text-forest">
                <ProcyLogo className="size-8" />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold">AgriLink</span>
                <span className="block text-xs text-sidebar-foreground/65">Rider</span>
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <CollapsibleSidebarGroup label="Main">
              <SidebarMenu>
                {navigation.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild tooltip={item.label} isActive={pathname === item.to}>
                      <Link to={item.to} activeOptions={{ exact: true }}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarCountBadge count={badges[item.to]} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </CollapsibleSidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <div className="mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarImage
                    src={rider.avatarUrl ?? undefined}
                    alt={`${rider.displayName} profile photo`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                    {rider.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="max-w-36 truncate text-sm font-semibold">{rider.displayName}</p>
                  <p className="text-xs text-sidebar-foreground/65">Rider</p>
                </div>
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Profile"
                  isActive={pathname === "/rider/profile"}
                >
                  <Link to="/rider/profile">
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
        <div className="min-w-0 flex-1 bg-background">{children}</div>
      </SidebarProvider>
    </RoleGate>
  );
}

export function RiderPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-start gap-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur md:static md:px-8">
      <SidebarTrigger className="mt-1" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Rider</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      <WorkspaceHeaderActions role="Rider" />
    </header>
  );
}
