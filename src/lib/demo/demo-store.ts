import { useEffect, useState } from "react";

export function useDemoStore<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setValue(JSON.parse(stored) as T);
    } catch {
      setValue(fallback);
    }
  }, [fallback, key]);

  const save = (next: T | ((current: T) => T)) => {
    setValue((current) => {
      const updated = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      window.localStorage.setItem(key, JSON.stringify(updated));
      window.dispatchEvent(new Event(`${key}-changed`));
      return updated;
    });
  };

  return [value, save] as const;
}
