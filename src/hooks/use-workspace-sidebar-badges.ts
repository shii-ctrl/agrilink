import { useCallback, useEffect, useState } from "react";

import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import {
  getWorkspaceSidebarBadges,
  type WorkspaceSidebarBadges,
} from "@/services/workspaces/sidebar-badge-server-functions";

export function useWorkspaceSidebarBadges() {
  const [badges, setBadges] = useState<WorkspaceSidebarBadges>({});

  const refresh = useCallback(async () => {
    const nextBadges = await getWorkspaceSidebarBadges();
    setBadges(nextBadges);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useAutoRefresh(refresh, 12_000);

  return badges;
}
