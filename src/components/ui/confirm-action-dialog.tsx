import { CircleAlert, ShieldAlert } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/** A consistent, accessible replacement for browser confirmation pop-ups. */
export function useConfirmAction() {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);

  const finish = useCallback((accepted: boolean) => {
    resolver.current?.(accepted);
    resolver.current = null;
    setOptions(null);
  }, []);

  const requestConfirmation = useCallback((nextOptions: ConfirmationOptions) => {
    resolver.current?.(false);
    setOptions(nextOptions);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const confirmationDialog = (
    <AlertDialog open={Boolean(options)} onOpenChange={(open) => !open && finish(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <span
            className={`mb-1 flex size-11 items-center justify-center rounded-2xl ${
              options?.destructive
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            {options?.destructive ? (
              <ShieldAlert className="size-5" />
            ) : (
              <CircleAlert className="size-5" />
            )}
          </span>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          <AlertDialogDescription>{options?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>
            {options?.cancelLabel ?? "Keep it"}
          </AlertDialogCancel>
          <AlertDialogAction
            className={
              options?.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
            onClick={() => finish(true)}
          >
            {options?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { requestConfirmation, confirmationDialog };
}
