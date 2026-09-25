import { eq } from "drizzle-orm";

type NotificationDetails = { title: string; message: string; target?: string };

export async function notifyUser(userId: string, details: NotificationDetails) {
  const { db } = await import("@/db/client.server");
  const { notifications } = await import("@/db/schema");
  await db.insert(notifications).values({ id: crypto.randomUUID(), userId, ...details });
}

export async function notifyRole(roleName: string, details: NotificationDetails) {
  const { db } = await import("@/db/client.server");
  const { roles, userRoles, users, notifications } = await import("@/db/schema");
  const recipients = await db
    .select({ userId: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(roles.name, roleName));
  if (recipients.length) {
    await db
      .insert(notifications)
      .values(recipients.map(({ userId }) => ({ id: crypto.randomUUID(), userId, ...details })));
  }
}
