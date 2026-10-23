import { useEffect, useRef } from "react";

/** Refreshes saved workspace data while the page is visible without interrupting the user. */
export function useAutoRefresh(refresh: () => void | Promise<void>, intervalMs = 10_000) {
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void latestRefresh.current();
    };
    const timer = window.setInterval(refreshWhenVisible, intervalMs);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [intervalMs]);
}
