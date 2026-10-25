import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  name?: string;
  ariaLabel?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
};

function dateFromValue(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function valueFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel(value: string) {
  const date = dateFromValue(value);
  return date
    ? new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date)
    : "";
}

export function DatePicker({
  value,
  onValueChange,
  id,
  name,
  ariaLabel = "Choose date",
  disabled = false,
  min,
  max,
  className,
}: DatePickerProps) {
  const selectedDate = dateFromValue(value);
  const minDate = dateFromValue(min ?? "");
  const maxDate = dateFromValue(max ?? "");

  return (
    <Popover>
      {name ? <input name={name} type="hidden" value={value} /> : null}
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "h-11 rounded-xl border-primary/30 bg-card shadow-none hover:border-primary/60 hover:bg-accent/40",
            value ? "w-full justify-between px-4 font-medium" : "size-11 justify-center p-0",
            className,
          )}
        >
          {value ? <span>{dateLabel(value)}</span> : null}
          <CalendarDays className="size-4 shrink-0 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-auto rounded-2xl p-0 shadow-xl">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) onValueChange(valueFromDate(date));
          }}
          disabled={
            minDate || maxDate
              ? [
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]
              : undefined
          }
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
