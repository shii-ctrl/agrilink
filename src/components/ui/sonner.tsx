import { CheckCircle2, CircleAlert, Info, LoaderCircle, XCircle } from "lucide-react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton
      duration={5000}
      visibleToasts={3}
      offset={{ top: 24 }}
      icons={{
        success: (
          <span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="size-5" />
          </span>
        ),
        error: (
          <span className="grid size-9 place-items-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
            <XCircle className="size-5" />
          </span>
        ),
        warning: (
          <span className="grid size-9 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <CircleAlert className="size-5" />
          </span>
        ),
        info: (
          <span className="grid size-9 place-items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <Info className="size-5" />
          </span>
        ),
        loading: (
          <span className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <LoaderCircle className="size-5 animate-spin" />
          </span>
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast min-w-[min(92vw,360px)] gap-3 overflow-hidden rounded-2xl border bg-card px-4 py-3.5 pr-11 text-foreground shadow-field",
          success: "border-emerald-500/70",
          error: "border-red-500/70",
          warning: "border-amber-500/75",
          info: "border-blue-500/70",
          loading: "border-slate-400/60",
          default: "border-slate-400/60",
          title: "text-sm font-bold tracking-tight text-foreground",
          description: "mt-0.5 text-xs leading-relaxed text-muted-foreground",
          content: "gap-0.5",
          icon: "self-start",
          actionButton:
            "rounded-full bg-primary px-4 font-semibold text-primary-foreground hover:bg-secondary",
          cancelButton: "rounded-full bg-muted px-3 text-muted-foreground",
          closeButton:
            "!left-auto !right-2.5 !top-2.5 !size-7 !translate-x-0 !translate-y-0 rounded-full border-0 bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
