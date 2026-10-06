import { useEffect, useMemo, useState } from "react";

import { getCurrentSessionUser } from "@/lib/auth-functions";

/**
 * Gets the signed-in account from the server session for a role workspace.
 * The browser never decides which account name or role is displayed.
 */
export function useWorkspaceUser(role: string) {
  const [displayName, setDisplayName] = useState("Signed-in account");

  useEffect(() => {
    let mounted = true;
    void getCurrentSessionUser()
      .then((user) => {
        if (mounted && user?.roles.includes(role)) setDisplayName(user.displayName);
      })
      .catch(() => {
        // RoleGate keeps access protected and presents the sign-in screen if needed.
      });
    return () => {
      mounted = false;
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

  return { displayName, initials };
}
