import { useEffect, useRef } from "react";
import { agrilinkDataChangedEvent, isAgrilinkDataStorageEvent } from "@/lib/data/live-refresh";

/**
 * Refreshes saved workspace data while the page is visible without interrupting the user.
 *
 * Mutations, focus, reconnects, and cross-tab changes refresh immediately. The slower
 * interval is only a cross-device fallback so every mounted workspace does not hammer
 * the database while a user is idle. Pass 0 to keep event-driven refreshes only.
 */
export function useAutoRefresh(refresh: () => void | Promise<void>, intervalMs = 60_000) {
  const latestRefresh = useRef(refresh);
  const refreshing = useRef(false);
  latestRefresh.current = refresh;
  useEffect(() => {
    let active = true;
    let lastRefresh = 0;
    let pendingChange = false;
    const refreshWhenVisible = async () => {
      if (
        !active ||
        refreshing.current ||
        document.visibilityState !== "visible" ||
        !window.navigator.onLine
      ) {
        return;
      }
      if (Date.now() - lastRefresh < 2_000) return;
      refreshing.current = true;
      lastRefresh = Date.now();
      try {
        await latestRefresh.current();
      } catch {
        // Keep the last successful screen state during a short connection interruption.
      } finally {
        refreshing.current = false;
        if (pendingChange) {
          pendingChange = false;
          lastRefresh = 0;
          void refreshWhenVisible();
        }
      }
    };
    const refreshAfterChange = () => {
      if (refreshing.current) {
        pendingChange = true;
        return;
      }
      lastRefresh = 0;
      void refreshWhenVisible();
    };
    const refreshFromStorage = (event: StorageEvent) => {
      if (isAgrilinkDataStorageEvent(event)) refreshAfterChange();
    };
    const timer = intervalMs > 0 ? window.setInterval(refreshWhenVisible, intervalMs) : null;
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    window.addEventListener(agrilinkDataChangedEvent, refreshAfterChange);
    window.addEventListener("storage", refreshFromStorage);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      window.removeEventListener(agrilinkDataChangedEvent, refreshAfterChange);
      window.removeEventListener("storage", refreshFromStorage);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [intervalMs]);
}
