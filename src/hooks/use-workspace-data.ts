import { useCallback, useEffect, useRef, useState } from "react";

import { useAutoRefresh } from "@/hooks/use-auto-refresh";

type LoadOptions = { background?: boolean };

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "Please try again.";
}

/**
 * Keeps role-workspace data honest: a blank value means there is no data, not
 * that the request is still running or failed. Background refreshes preserve
 * the current screen and only surface an error when the first load fails.
 */
export function useWorkspaceData<T>(request: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<T | null>(null);

  const load = useCallback(
    async ({ background = false }: LoadOptions = {}) => {
      if (!background) setLoading(true);
      try {
        const nextData = await request();
        dataRef.current = nextData;
        setData(nextData);
        setError(null);
        return nextData;
      } catch (caught) {
        const nextError = messageFor(caught);
        if (!background || dataRef.current === null) setError(nextError);
        throw caught;
      } finally {
        if (!background) setLoading(false);
      }
    },
    [request],
  );

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);
  useAutoRefresh(() =>
    load({ background: true })
      .then(() => undefined)
      .catch(() => undefined),
  );

  return { data, loading, error, reload: load };
}
