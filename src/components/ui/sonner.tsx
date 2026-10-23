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
        success: <CheckCircle2 className="size-5" />,
        error: <XCircle className="size-5" />,
        warning: <CircleAlert className="size-5" />,
        info: <Info className="size-5" />,
        loading: <LoaderCircle className="size-5 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast min-w-[min(92vw,380px)] overflow-hidden rounded-3xl border bg-card/95 px-5 py-4 text-foreground shadow-field backdrop-blur",
          success: "border-primary/35",
          error: "border-destructive/35",
          warning: "border-[color:var(--semi)]/45",
          info: "border-primary/25",
          title: "font-semibold tracking-tight text-foreground",
          description: "mt-1 text-sm leading-relaxed text-muted-foreground",
          icon: "mt-0.5 text-primary group-data-[type=error]:text-destructive group-data-[type=warning]:text-[color:var(--semi)]",
          actionButton:
            "rounded-full bg-primary px-4 font-semibold text-primary-foreground hover:bg-secondary",
          cancelButton: "rounded-full bg-muted px-3 text-muted-foreground",
          closeButton:
            "right-3 top-3 rounded-full border-border bg-card text-muted-foreground shadow-card hover:bg-muted hover:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
