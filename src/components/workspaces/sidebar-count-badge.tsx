import { SidebarMenuBadge } from "@/components/ui/sidebar";

export function SidebarCountBadge({ count }: { count?: number }) {
  if (!count || count < 1) return null;

  return (
    <SidebarMenuBadge
      aria-label={`${count} pending item${count === 1 ? "" : "s"}`}
      className="right-2 rounded-full bg-primary px-1.5 font-bold text-primary-foreground shadow-sm"
    >
      {count > 99 ? "99+" : count}
    </SidebarMenuBadge>
  );
}
