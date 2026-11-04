import { Bell, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  deleteReadNotification,
  getCurrentNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/messaging/notification-server-functions";

export function NotificationCenter({ role }: { role: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const knownNotificationIds = useRef<Set<string> | null>(null);
  const refreshing = useRef(false);
  const unread = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  useEffect(() => {
    const refresh = async () => {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        const next = await getCurrentNotifications();
        const previous = knownNotificationIds.current;
        if (previous) {
          next
            .filter((notification) => !notification.read && !previous.has(notification.id))
            .forEach((notification) => {
              toast(notification.title, { description: notification.message, duration: 6_000 });
            });
        }
        knownNotificationIds.current = new Set(next.map((notification) => notification.id));
        setNotifications(next);
      } catch {
        // Keep the last successful result visible during a short connection interruption.
      } finally {
        refreshing.current = false;
      }
    };
    void refresh();
    const polling = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 12_000);
    const refreshOnFocus = () => void refresh();
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => {
      window.clearInterval(polling);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [role]);

  async function openNotification(notification: Notification) {
    try {
      await markNotificationRead({ data: { id: notification.id } });
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      );
      if (notification.target) window.location.assign(notification.target);
    } catch {
      toast.error("Could not open this notification. Please try again.");
    }
  }

  async function deleteNotification(notification: Notification) {
    if (!notification.read) return;
    try {
      await deleteReadNotification({ data: { id: notification.id } });
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      knownNotificationIds.current?.delete(notification.id);
      toast.success("Notification deleted");
    } catch (error) {
      toast.error("Could not delete this notification", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen)
          void getCurrentNotifications()
            .then(setNotifications)
            .catch(() => undefined);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative rounded-full"
          aria-label="Open notifications"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,390px)] p-0" sideOffset={10}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0
                ? `${unread} unread update${unread === 1 ? "" : "s"}`
                : "You are all caught up"}
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={async () => {
                try {
                  await markAllNotificationsRead();
                  setNotifications((current) => current.map((item) => ({ ...item, read: true })));
                } catch {
                  toast.error("Could not mark notifications as read. Please try again.");
                }
              }}
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[min(55vh,420px)] overflow-y-auto">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex gap-2 border-b border-border pr-2 last:border-b-0 ${
                notification.read ? "" : "bg-primary/[0.045]"
              }`}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/70"
                onClick={() => openNotification(notification)}
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read ? "bg-muted-foreground/30" : "bg-primary"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-medium">{notification.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(notification.time).toLocaleString("en-PH", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    {notification.message}
                  </span>
                  {notification.target && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      Open related record <ExternalLink className="size-3" />
                    </span>
                  )}
                </span>
              </button>
              {notification.read ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-2 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete notification: ${notification.title}`}
                  onClick={() => void deleteNotification(notification)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type Notification = {
  id: string;
  title: string;
  message: string;
  target: string | null;
  read: boolean;
  time: string;
};
