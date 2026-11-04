import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ResponsiveFilterPanel({
  children,
  activeCount = 0,
  title = "Filters",
  className,
  contentClassName,
}: {
  children: ReactNode;
  activeCount?: number;
  title?: string;
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("border-b border-border", className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left md:hidden"
      >
        <span className="flex items-center gap-2 font-semibold">
          <SlidersHorizontal className="size-4 text-primary" />
          {title}
          {activeCount > 0 ? (
            <span className="grid min-w-6 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("size-4 transition-transform", open ? "rotate-180" : undefined)}
        />
      </button>
      <div
        className={cn("gap-3 p-4 pt-0 md:grid md:p-5", open ? "grid" : "hidden", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
}
