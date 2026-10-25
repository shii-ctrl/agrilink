import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, defaultValue, onChange, ...props }, ref) => {
    const isDateInput = type === "date";
    const [hasDateValue, setHasDateValue] = React.useState(() =>
      isDateInput ? Boolean(value ?? defaultValue) : false,
    );

    React.useEffect(() => {
      if (isDateInput && value !== undefined) setHasDateValue(Boolean(value));
    }, [isDateInput, value]);

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          type === "date" &&
            "h-11 rounded-xl border-primary/30 bg-card px-4 pr-2 font-medium tracking-wide shadow-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/35",
          className,
        )}
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        data-empty-date={isDateInput && !hasDateValue ? "true" : undefined}
        onChange={(event) => {
          if (isDateInput) setHasDateValue(Boolean(event.currentTarget.value));
          onChange?.(event);
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
