import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton
      duration={4200}
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            "group toast min-w-[360px] rounded-2xl border border-primary/30 bg-card px-4 py-3 text-foreground shadow-field",
          title: "font-semibold text-foreground",
          description: "mt-1 text-sm text-muted-foreground",
          actionButton:
            "rounded-full bg-primary px-4 font-semibold text-primary-foreground hover:bg-secondary",
          cancelButton: "rounded-full bg-muted px-3 text-muted-foreground",
          closeButton:
            "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
