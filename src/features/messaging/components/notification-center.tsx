import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getCurrentNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/messaging/notification-server-functions";

export function NotificationCenter({ role }: { role: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unread = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  useEffect(() => {
    const refresh = () =>
      void getCurrentNotifications()
        .then(setNotifications)
        .catch(() => setNotifications([]));
    refresh();
    const polling = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(polling);
  }, [role]);

  async function openNotification(notification: Notification) {
    await markNotificationRead({ data: { id: notification.id } });
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    );
    if (notification.target) window.location.assign(notification.target);
  }

  return (
    <Popover>
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
                await markAllNotificationsRead();
                setNotifications((current) => current.map((item) => ({ ...item, read: true })));
              }}
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[min(55vh,420px)] overflow-y-auto">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              className={`flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/70 ${
                notification.read ? "" : "bg-primary/[0.045]"
              }`}
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
