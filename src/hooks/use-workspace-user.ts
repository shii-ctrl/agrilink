import { useEffect, useMemo, useState } from "react";

import { getCurrentSessionUser } from "@/services/auth/auth-functions";

/**
 * Gets the signed-in account from the server session for a role workspace.
 * The browser never decides which account name or role is displayed.
 */
export function useWorkspaceUser(role: string) {
  const [displayName, setDisplayName] = useState("Signed-in account");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const onProfileUpdated = (event: Event) => {
      const update = (
        event as CustomEvent<{
          role?: string;
          displayName?: string;
          avatarUrl?: string | null;
        }>
      ).detail;
      if (!update || update.role !== role) return;
      if (typeof update.displayName === "string") setDisplayName(update.displayName);
      if (typeof update.avatarUrl === "string" || update.avatarUrl === null) {
        setAvatarUrl(update.avatarUrl);
      }
    };

    window.addEventListener("agrilink:profile-updated", onProfileUpdated);
    void getCurrentSessionUser()
      .then((user) => {
        if (mounted && user?.roles.includes(role)) {
          setDisplayName(user.displayName);
          setAvatarUrl(user.avatarUrl ?? null);
        }
      })
      .catch(() => {
        // RoleGate keeps access protected and presents the sign-in screen if needed.
      });
    return () => {
      mounted = false;
      window.removeEventListener("agrilink:profile-updated", onProfileUpdated);
    };
  }, [role]);

  const initials = useMemo(
    () =>
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "A",
    [displayName],
  );

  return { displayName, initials, avatarUrl };
}
