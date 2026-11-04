import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-base shadow-sm transition-[border-color,box-shadow,background-color] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60 md:text-sm",
          type === "date" &&
            "h-11 rounded-xl border-primary/30 bg-card px-4 pr-2 font-medium tracking-wide shadow-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/35",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
