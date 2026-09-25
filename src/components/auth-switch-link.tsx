import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

type AuthRoute = "/login" | "/register" | "/forgot-password";

export function AuthSwitchLink({
  to,
  children,
  className,
}: {
  to: AuthRoute;
  children: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();

  return (
    <Link
      to={to}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        const transition = document.startViewTransition?.(() => navigate({ to }));
        if (!transition) navigate({ to });
      }}
    >
      {children}
    </Link>
  );
}
