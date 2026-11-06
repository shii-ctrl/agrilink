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
          <span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-emerald-700 ring-4 ring-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-950/40">
            <CheckCircle2 className="size-5" />
          </span>
        ),
        error: (
          <span className="grid size-9 place-items-center rounded-full bg-red-100 text-red-700 ring-4 ring-red-50 dark:bg-red-950 dark:text-red-300 dark:ring-red-950/40">
            <XCircle className="size-5" />
          </span>
        ),
        warning: (
          <span className="grid size-9 place-items-center rounded-full bg-amber-100 text-amber-700 ring-4 ring-amber-50 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-950/40">
            <CircleAlert className="size-5" />
          </span>
        ),
        info: (
          <span className="grid size-9 place-items-center rounded-full bg-blue-100 text-blue-700 ring-4 ring-blue-50 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-950/40">
            <Info className="size-5" />
          </span>
        ),
        loading: (
          <span className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-700 ring-4 ring-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-800/40">
            <LoaderCircle className="size-5 animate-spin" />
          </span>
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast min-w-[min(92vw,380px)] !items-start !gap-4 overflow-hidden rounded-2xl border bg-card !px-4 !py-4 !pr-12 text-foreground shadow-field",
          success: "border-emerald-500/70",
          error: "border-red-500/70",
          warning: "border-amber-500/75",
          info: "border-blue-500/70",
          loading: "border-slate-400/60",
          default: "border-slate-400/60",
          title: "pr-1 text-sm font-bold leading-5 tracking-tight text-foreground",
          description: "mt-0.5 text-xs leading-5 text-muted-foreground",
          content: "min-w-0 !gap-0.5 pt-0.5",
          icon: "!m-0 !mt-0.5 !flex !size-9 !shrink-0 !items-center !justify-center",
          actionButton:
            "rounded-full bg-primary px-4 font-semibold text-primary-foreground hover:bg-secondary",
          cancelButton: "rounded-full bg-muted px-3 text-muted-foreground",
          closeButton:
            "!absolute !left-auto !right-1 !top-1 !size-8 !translate-none !transform-none rounded-full !border-0 !bg-transparent text-muted-foreground !shadow-none hover:!bg-muted hover:text-foreground [&_svg]:size-4",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
