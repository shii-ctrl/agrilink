import { and, desc, eq, isNull } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const notificationIdInput = z.object({ id: z.string().uuid() });

export const getCurrentNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/lib/auth-server");
  const user = await requireUser();
  const { db } = await import("@/db/client.server");
  const { notifications } = await import("@/db/schema");
  const rows = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      message: notifications.message,
      target: notifications.target,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(80);
  return rows.map((row) => ({
    ...row,
    read: row.readAt !== null,
    time: row.createdAt.toISOString(),
  }));
});

export const markNotificationRead = createServerFn({ method: "POST" })
  .validator(notificationIdInput)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/lib/auth-server");
    const user = await requireUser();
    const { db } = await import("@/db/client.server");
    const { notifications } = await import("@/db/schema");
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, data.id), eq(notifications.userId, user.id)));
    return { id: data.id };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const { requireUser } = await import("@/lib/auth-server");
  const user = await requireUser();
  const { db } = await import("@/db/client.server");
  const { notifications } = await import("@/db/schema");
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  return { ok: true };
});
