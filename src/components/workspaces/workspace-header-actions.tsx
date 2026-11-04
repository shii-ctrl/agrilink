import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationCenter } from "@/features/messaging/components/notification-center";

export function WorkspaceHeaderActions({ role }: { role: string }) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <ThemeToggle />
      <NotificationCenter role={role} />
    </div>
  );
}
