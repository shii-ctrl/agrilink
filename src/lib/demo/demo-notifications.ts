export type DemoNotification = {
  id: string;
  role: string;
  title: string;
  message: string;
  time: string;
  target?: string;
  read: boolean;
};

const notificationKey = "agrilink-demo-notifications";
const notificationEvent = "agrilink-demo-notifications-changed";
const channel =
  typeof window !== "undefined" ? new BroadcastChannel("agrilink-notifications") : null;

export function getDemoNotifications(role: string): DemoNotification[] {
  const stored = window.localStorage.getItem(notificationKey);
  if (!stored) return [];
  try {
    return (JSON.parse(stored) as DemoNotification[])
      .map((notification) => ({ ...notification, read: notification.read ?? false }))
      .filter((notification) => notification.role === role);
  } catch {
    return [];
  }
}

function saveAllNotifications(notifications: DemoNotification[]) {
  window.localStorage.setItem(notificationKey, JSON.stringify(notifications.slice(0, 80)));
  window.dispatchEvent(new Event(notificationEvent));
}

export function sendDemoNotification(notification: Omit<DemoNotification, "id" | "time" | "read">) {
  const next: DemoNotification = {
    ...notification,
    id: crypto.randomUUID(),
    time: "Just now",
    read: false,
  };
  const stored = window.localStorage.getItem(notificationKey);
  const current = stored ? (JSON.parse(stored) as DemoNotification[]) : [];
  saveAllNotifications([next, ...current]);
  channel?.postMessage(next);
  return next;
}

export function markDemoNotificationRead(id: string) {
  const stored = window.localStorage.getItem(notificationKey);
  const current = stored ? (JSON.parse(stored) as DemoNotification[]) : [];
  saveAllNotifications(
    current.map((notification) =>
      notification.id === id ? { ...notification, read: true } : notification,
    ),
  );
}

export function markAllDemoNotificationsRead(role: string) {
  const stored = window.localStorage.getItem(notificationKey);
  const current = stored ? (JSON.parse(stored) as DemoNotification[]) : [];
  saveAllNotifications(
    current.map((notification) =>
      notification.role === role ? { ...notification, read: true } : notification,
    ),
  );
}

export function subscribeDemoNotifications(
  role: string,
  callback: (items: DemoNotification[]) => void,
) {
  const refresh = () => callback(getDemoNotifications(role));
  const onStorage = (event: StorageEvent) => {
    if (event.key === notificationKey) refresh();
  };
  const onChannelMessage = () => refresh();
  window.addEventListener(notificationEvent, refresh);
  window.addEventListener("storage", onStorage);
  channel?.addEventListener("message", onChannelMessage);
  return () => {
    window.removeEventListener(notificationEvent, refresh);
    window.removeEventListener("storage", onStorage);
    channel?.removeEventListener("message", onChannelMessage);
  };
}
