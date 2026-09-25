import { Link, useNavigate } from "@tanstack/react-router";
import {
  ClipboardList,
  Leaf,
  LogOut,
  MessageCircle,
  PackageCheck,
  Sprout,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { signOutDemoAccount } from "@/lib/demo-session";
import { RoleGate } from "@/components/role-gate";
import { NotificationCenter } from "@/components/notification-center";
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
  return (
    <RoleGate role="Farmer">
      <SidebarProvider>
        <Sidebar collapsible="offcanvas" className="border-r border-border/70">
          <SidebarHeader className="p-4">
            <Link to="/" className="flex items-center gap-2 rounded-lg px-2 py-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-lime text-forest">
                <Leaf className="size-5" />
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
                      <SidebarMenuButton asChild tooltip={item.label}>
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
                  JD
                </span>
                <div>
                  <p className="text-sm font-semibold">Juan Dela Cruz</p>
                  <p className="text-xs text-sidebar-foreground/65">Farmer Member</p>
                </div>
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Profile">
                  <Link to="/farmer/profile">
                    <UserRound />
                    <span>Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Logout"
                  onClick={async () => {
                    await signOutDemoAccount();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut />
                  <span>Logout</span>
                </SidebarMenuButton>
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
