import { type ReactElement, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type LogoutConfirmationProps = {
  children: ReactElement;
  onConfirm: () => Promise<void> | void;
};

export function LogoutConfirmation({ children, onConfirm }: LogoutConfirmationProps) {
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isLoggingOut) setOpen(nextOpen);
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Log out of AgriLink?</AlertDialogTitle>
          <AlertDialogDescription>
            You will need to sign in again to return to your account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoggingOut}>Stay signed in</AlertDialogCancel>
          <AlertDialogAction
            disabled={isLoggingOut}
            onClick={(event) => {
              event.preventDefault();
              void confirmLogout();
            }}
          >
            {isLoggingOut ? "Logging out…" : "Log out"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
