import { LoaderCircle } from "lucide-react";
import { useSyncExternalStore } from "react";

import { getActionLockSnapshot, subscribeActionLock } from "@/lib/ui/action-lock";

export function ActionLockShield() {
  const state = useSyncExternalStore(subscribeActionLock, getActionLockSnapshot, () => "idle");

  if (state !== "busy") return null;

  return (
    <div
      className="fixed inset-0 z-[10000] cursor-wait bg-background/10 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-label="Processing your request"
    >
      <div className="absolute left-1/2 top-5 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium shadow-lg sm:top-7">
        <LoaderCircle className="size-4 animate-spin text-primary" />
        Processing… Please wait
      </div>
    </div>
  );
}
