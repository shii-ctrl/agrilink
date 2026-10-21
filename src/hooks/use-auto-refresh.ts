import { useEffect, useRef } from "react";

/** Refreshes saved workspace data while the page is visible without interrupting the user. */
export function useAutoRefresh(refresh: () => void | Promise<void>, intervalMs = 15_000) {
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void latestRefresh.current();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
}
