import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { getCurrentSessionUser } from "@/lib/auth-functions";

export function RoleGate({ role, children }: { role: string; children: ReactNode }) {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    void getCurrentSessionUser()
      .then((account) => {
        if (!active) return;
        if (!account) {
          navigate({ to: "/login" });
          return;
        }
        if (!account.roles.includes(role)) {
          navigate({ to: "/" });
          return;
        }
        setAllowed(true);
      })
      .catch(() => navigate({ to: "/login" }));
    return () => {
      active = false;
    };
  }, [navigate, role]);

  if (!allowed)
    return (
      <main className="grid min-h-svh place-items-center bg-background p-6 text-sm text-muted-foreground">
        Checking workspace access…
      </main>
    );
  return <>{children}</>;
}
