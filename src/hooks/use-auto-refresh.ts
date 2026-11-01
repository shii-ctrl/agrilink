import { useEffect, useRef } from "react";
import { agrilinkDataChangedEvent, isAgrilinkDataStorageEvent } from "@/lib/data/live-refresh";

/** Refreshes saved workspace data while the page is visible without interrupting the user. */
export function useAutoRefresh(refresh: () => void | Promise<void>, intervalMs = 5_000) {
  const latestRefresh = useRef(refresh);
  const refreshing = useRef(false);
  latestRefresh.current = refresh;
  useEffect(() => {
    const refreshWhenVisible = async () => {
      if (
        refreshing.current ||
        document.visibilityState !== "visible" ||
        !window.navigator.onLine
      ) {
        return;
      }
      refreshing.current = true;
      try {
        await latestRefresh.current();
      } catch {
        // Keep the last successful screen state during a short connection interruption.
      } finally {
        refreshing.current = false;
      }
    };
    const refreshFromStorage = (event: StorageEvent) => {
      if (isAgrilinkDataStorageEvent(event)) void refreshWhenVisible();
    };
    const timer = window.setInterval(refreshWhenVisible, intervalMs);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    window.addEventListener(agrilinkDataChangedEvent, refreshWhenVisible);
    window.addEventListener("storage", refreshFromStorage);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      window.removeEventListener(agrilinkDataChangedEvent, refreshWhenVisible);
      window.removeEventListener("storage", refreshFromStorage);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [intervalMs]);
}
