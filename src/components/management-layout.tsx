import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileBarChart,
  Leaf,
  LineChart,
  LogOut,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  Settings,
  UsersRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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
import { signOutDemoAccount } from "@/lib/demo-session";
import { RoleGate } from "@/components/role-gate";
import { NotificationCenter } from "@/components/notification-center";
import { getCurrentSessionUser } from "@/lib/auth-functions";

const managementSections = [
  { label: "Main", items: [{ label: "Dashboard", icon: BarChart3, to: "/management" as const }] },
  {
    label: "Administration",
    items: [{ label: "User Accounts", icon: UsersRound, to: "/management/users" as const }],
  },
  {
    label: "Operations",
    items: [
      { label: "Products", icon: Boxes, to: "/management/products" as const },
      { label: "Production", icon: ClipboardList, to: "/management/production" as const },
      { label: "Receiving", icon: PackageCheck, to: "/management/receiving" as const },
      { label: "Sales", icon: ReceiptText, to: "/management/sales" as const },
      { label: "Transactions", icon: FileBarChart, to: "/management/transactions" as const },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Decision Support", icon: LineChart, to: "/management/decision-support" as const },
      { label: "Reports / Analytics", icon: BarChart3, to: "/management/reports" as const },
    ],
  },
  {
    label: "Collaboration",
    items: [{ label: "Community", icon: MessageCircle, to: "/management/community" as const }],
  },
] as const;

export function ManagementLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [managerName, setManagerName] = useState("Management");

  useEffect(() => {
    void getCurrentSessionUser().then((user) => {
      if (user?.roles.includes("Management")) setManagerName(user.displayName);
    });
  }, []);
  const initials = managerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <RoleGate role="Management">
      <SidebarProvider>
        <Sidebar collapsible="offcanvas">
          <SidebarHeader className="p-4">
            <Link to="/" className="flex items-center gap-2 rounded-lg px-2 py-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-lime text-forest">
                <Leaf className="size-5" />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold">AgriLink</span>
                <span className="block text-xs text-sidebar-foreground/65">Management</span>
              </span>
            </Link>
          </SidebarHeader>

          <SidebarContent>
            {managementSections.map((section) => (
              <SidebarGroup key={section.label}>
                <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
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
            ))}
          </SidebarContent>

          <SidebarFooter className="p-4">
            <div className="mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {initials || "M"}
                </span>
                <div>
                  <p className="text-sm font-semibold">{managerName}</p>
                  <p className="text-xs text-sidebar-foreground/65">Management</p>
                </div>
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Profile">
                  <Link to="/management/profile">
                    <Settings />
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
            <p className="px-2 pt-2 text-xs leading-relaxed text-sidebar-foreground/55">
              Signed-in Management workspace. Account access is protected by your active session.
            </p>
          </SidebarFooter>
        </Sidebar>

        <div className="min-w-0 flex-1 bg-background">{children}</div>
      </SidebarProvider>
    </RoleGate>
  );
}

export function ManagementPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="flex items-start gap-3 border-b border-border bg-background px-4 py-4 md:px-8">
      <SidebarTrigger className="mt-1" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Management</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="ml-auto">
        <NotificationCenter role="Management" />
      </div>
    </header>
  );
}
