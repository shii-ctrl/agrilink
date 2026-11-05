import { Bell, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  deleteReadNotification,
  getCurrentNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/messaging/notification-server-functions";
import { authSessionChangedEvent } from "@/lib/auth/session-events";
import { agrilinkDataChangedEvent, isAgrilinkDataStorageEvent } from "@/lib/data/live-refresh";

type Notification = {
  id: string;
  title: string;
  message: string;
  target: string | null;
  read: boolean;
  time: string;
};

type NotificationListener = (notifications: Notification[]) => void;

let notificationSnapshot: Notification[] = [];
let notificationIds: Set<string> | null = null;
let notificationRefresh: Promise<void> | null = null;
let notificationRefreshGeneration = -1;
let notificationSessionGeneration = 0;
let notificationSyncUsers = 0;
let stopNotificationSync: (() => void) | null = null;
const notificationListeners = new Set<NotificationListener>();

function publishNotifications(next: Notification[]) {
  notificationSnapshot = next;
  notificationListeners.forEach((listener) => listener(next));
}

function updateNotifications(update: (current: Notification[]) => Notification[]) {
  publishNotifications(update(notificationSnapshot));
}

function refreshNotifications({ announce = true }: { announce?: boolean } = {}) {
  const generation = notificationSessionGeneration;
  if (notificationRefresh && notificationRefreshGeneration === generation) {
    return notificationRefresh;
  }
  notificationRefreshGeneration = generation;
  const refresh = getCurrentNotifications()
    .then((next) => {
      if (generation !== notificationSessionGeneration) return;
      if (announce && notificationIds) {
        next
          .filter((notification) => !notification.read && !notificationIds?.has(notification.id))
          .forEach((notification) => {
            toast(notification.title, { description: notification.message, duration: 6_000 });
          });
      }
      notificationIds = new Set(next.map((notification) => notification.id));
      publishNotifications(next);
    })
    .catch(() => {
      // Keep the last successful inbox visible during a short connection interruption.
    })
    .finally(() => {
      if (notificationRefresh === refresh) notificationRefresh = null;
    });
  notificationRefresh = refresh;
  return refresh;
}

function subscribeNotifications(listener: NotificationListener) {
  notificationListeners.add(listener);
  return () => notificationListeners.delete(listener);
}

function startNotificationSync() {
  notificationSyncUsers += 1;
  if (notificationSyncUsers === 1) {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && window.navigator.onLine) {
        void refreshNotifications();
      }
    };
    const refreshFromStorage = (event: StorageEvent) => {
      if (isAgrilinkDataStorageEvent(event)) refreshWhenVisible();
    };
    const refreshAfterSessionChange = () => {
      notificationSessionGeneration += 1;
      notificationIds = null;
      publishNotifications([]);
      void refreshNotifications({ announce: false });
    };
    void refreshNotifications({ announce: false });
    const timer = window.setInterval(refreshWhenVisible, 8_000);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    window.addEventListener(agrilinkDataChangedEvent, refreshWhenVisible);
    window.addEventListener("storage", refreshFromStorage);
    window.addEventListener(authSessionChangedEvent, refreshAfterSessionChange);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    stopNotificationSync = () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      window.removeEventListener(agrilinkDataChangedEvent, refreshWhenVisible);
      window.removeEventListener("storage", refreshFromStorage);
      window.removeEventListener(authSessionChangedEvent, refreshAfterSessionChange);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }
  return () => {
    notificationSyncUsers = Math.max(0, notificationSyncUsers - 1);
    if (notificationSyncUsers === 0) {
      stopNotificationSync?.();
      stopNotificationSync = null;
    }
  };
}

export function NotificationCenter({ role }: { role: string }) {
  const [notifications, setNotifications] = useState<Notification[]>(notificationSnapshot);
  const [open, setOpen] = useState(false);
  const unread = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  useEffect(() => {
    const unsubscribe = subscribeNotifications(setNotifications);
    const stopSync = startNotificationSync();
    return () => {
      unsubscribe();
      stopSync();
    };
  }, [role]);

  async function openNotification(notification: Notification) {
    try {
      await markNotificationRead({ data: { id: notification.id } });
      updateNotifications((current) =>
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
      updateNotifications((current) => current.filter((item) => item.id !== notification.id));
      notificationIds?.delete(notification.id);
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
        if (nextOpen) void refreshNotifications({ announce: false });
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative size-10 rounded-full border-border/70 bg-card/80 shadow-sm hover:bg-accent"
          aria-label="Open notifications"
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground shadow-sm">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border-border/70 p-0 shadow-xl sm:w-[390px]"
        sideOffset={10}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Bell className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {unread > 0
                  ? `${unread} unread update${unread === 1 ? "" : "s"}`
                  : "You are all caught up"}
              </p>
            </div>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={async () => {
                try {
                  await markAllNotificationsRead();
                  updateNotifications((current) =>
                    current.map((item) => ({ ...item, read: true })),
                  );
                } catch {
                  toast.error("Could not mark notifications as read. Please try again.");
                }
              }}
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[min(65dvh,460px)] overflow-y-auto overscroll-contain">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex gap-2 border-b border-border pr-2 last:border-b-0 ${
                notification.read ? "" : "bg-primary/[0.07]"
              }`}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 gap-3 px-3 py-3.5 text-left transition-colors hover:bg-muted/70"
                onClick={() => openNotification(notification)}
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read ? "bg-muted-foreground/30" : "bg-primary"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="line-clamp-2 font-semibold leading-snug">
                      {notification.title}
                    </span>
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
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                <Bell className="size-5" />
              </span>
              <p className="font-medium text-foreground">No notifications yet</p>
              <p className="mt-1 text-xs">Order and message updates will appear here.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
