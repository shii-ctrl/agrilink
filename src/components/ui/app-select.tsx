import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type AppSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type AppSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: AppSelectOption[];
  id?: string | undefined;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
  onReset?: () => void;
};

export function AppSelect({
  value,
  onValueChange,
  options,
  id,
  name,
  placeholder = "Choose an option",
  ariaLabel,
  disabled = false,
  searchable = options.length > 7,
  className,
  onReset,
}: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleOptions = useMemo(
    () =>
      normalizedQuery
        ? options.filter((option) =>
            `${option.label} ${option.description ?? ""}`
              .toLocaleLowerCase()
              .includes(normalizedQuery),
          )
        : options,
    [normalizedQuery, options],
  );

  useEffect(() => {
    const form = triggerRef.current?.closest("form");
    if (!form || !onReset) return;

    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [onReset]);

  return (
    <>
      {name ? <input name={name} type="hidden" value={value} /> : null}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled}
            className={cn(
              "h-auto min-h-10 w-full justify-between rounded-xl px-3 py-2 text-left font-normal shadow-none hover:bg-accent/40",
              className,
            )}
          >
            <span className="min-w-0 truncate">
              {selectedOption?.label ?? (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <ChevronDown className="ml-3 size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-[min(92vw,28rem)] overflow-hidden rounded-2xl p-0 shadow-xl"
        >
          {searchable ? (
            <div className="border-b border-border bg-popover p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search choices"
                  className="pl-9"
                />
              </div>
            </div>
          ) : null}
          <div
            role="listbox"
            tabIndex={0}
            className="max-h-[min(18rem,50dvh)] touch-pan-y overflow-y-auto overscroll-contain p-2 [scrollbar-gutter:stable]"
            onWheel={(event) => {
              event.currentTarget.scrollTop += event.deltaY;
              event.stopPropagation();
            }}
          >
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matching choices.
              </p>
            ) : (
              visibleOptions.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => {
                      onValueChange(option.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-accent/70 disabled:cursor-not-allowed disabled:opacity-50",
                      isSelected && "bg-accent text-accent-foreground",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.description ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? <Check className="size-4 shrink-0 text-primary" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
