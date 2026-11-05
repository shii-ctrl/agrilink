import { useCallback, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import {
  getWorkspaceSidebarBadges,
  markWorkspaceSidebarTargetRead,
  type WorkspaceSidebarBadges,
} from "@/services/workspaces/sidebar-badge-server-functions";

export function useWorkspaceSidebarBadges() {
  const [badges, setBadges] = useState<WorkspaceSidebarBadges>({});
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const dismissibleTarget = [
    "/marketer/community",
    "/accounting/community",
    "/management/community",
    "/rider/disputes",
    "/rider/community",
    "/farmer/receiving",
    "/farmer/earnings",
    "/farmer/community",
  ].find((target) => pathname === target || pathname.startsWith(`${target}/`));
  const openTargetCount = dismissibleTarget ? (badges[dismissibleTarget] ?? 0) : 0;

  const refresh = useCallback(async () => {
    const nextBadges = await getWorkspaceSidebarBadges();
    setBadges(nextBadges);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!dismissibleTarget || openTargetCount < 1) return;
    setBadges((current) => ({ ...current, [dismissibleTarget]: 0 }));
    void markWorkspaceSidebarTargetRead({
      data: {
        target: dismissibleTarget as Parameters<
          typeof markWorkspaceSidebarTargetRead
        >[0]["data"]["target"],
      },
    })
      .then(refresh)
      .catch(() => {});
  }, [dismissibleTarget, openTargetCount, refresh]);
  useAutoRefresh(refresh, 12_000);

  return badges;
}
