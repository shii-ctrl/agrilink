import { CircleAlert, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  details?: ReactNode;
  destructive?: boolean;
  holdToConfirmMs?: number;
};

/** A consistent, accessible replacement for browser confirmation pop-ups. */
export function useConfirmAction() {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const [secondsUntilConfirm, setSecondsUntilConfirm] = useState(0);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);

  useEffect(() => {
    const holdToConfirmMs = options?.holdToConfirmMs ?? 0;
    if (!holdToConfirmMs) {
      setSecondsUntilConfirm(0);
      return;
    }

    const readyAt = Date.now() + holdToConfirmMs;
    const updateCountdown = () => {
      setSecondsUntilConfirm(Math.max(0, Math.ceil((readyAt - Date.now()) / 1_000)));
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 100);
    return () => window.clearInterval(timer);
  }, [options]);

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
          {options?.details ? <div className="mt-2">{options.details}</div> : null}
          {secondsUntilConfirm > 0 ? (
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              Please review the details. Confirmation unlocks in {secondsUntilConfirm} second
              {secondsUntilConfirm === 1 ? "" : "s"}.
            </p>
          ) : null}
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
            disabled={secondsUntilConfirm > 0}
            onClick={() => {
              if (secondsUntilConfirm === 0) finish(true);
            }}
          >
            {secondsUntilConfirm > 0
              ? `${options?.confirmLabel} (${secondsUntilConfirm}s)`
              : options?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { requestConfirmation, confirmationDialog };
}
