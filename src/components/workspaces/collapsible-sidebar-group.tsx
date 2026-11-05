import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@/components/ui/sidebar";

export function CollapsibleSidebarGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <SidebarGroup>
      <details open className="group/sidebar-section">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>{label}</span>
            <ChevronDown className="size-3.5 transition-transform group-open/sidebar-section:rotate-180" />
          </SidebarGroupLabel>
        </summary>
        <SidebarGroupContent>{children}</SidebarGroupContent>
      </details>
    </SidebarGroup>
  );
}
