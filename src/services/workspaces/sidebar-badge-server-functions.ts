import { createServerFn } from "@tanstack/react-start";
import { and, count, countDistinct, eq, inArray, isNull, like } from "drizzle-orm";
import { z } from "zod";

export type WorkspaceSidebarBadges = Record<string, number>;

const dismissibleSidebarTargets = [
  "/marketer/disputes",
  "/marketer/community",
  "/accounting/community",
  "/management/community",
  "/rider/disputes",
  "/rider/community",
  "/farmer/receiving",
  "/farmer/earnings",
  "/farmer/community",
] as const;

const targetRoles: Record<(typeof dismissibleSidebarTargets)[number], string> = {
  "/marketer/disputes": "Marketer",
  "/marketer/community": "Marketer",
  "/accounting/community": "Accounting",
  "/management/community": "Management",
  "/rider/disputes": "Rider",
  "/rider/community": "Rider",
  "/farmer/receiving": "Farmer",
  "/farmer/earnings": "Farmer",
  "/farmer/community": "Farmer",
};

export const markWorkspaceSidebarTargetRead = createServerFn({ method: "POST" })
  .validator(z.object({ target: z.enum(dismissibleSidebarTargets) }))
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/services/auth/auth-server");
    const user = await requireUser();
    const requiredRole = targetRoles[data.target];
    if (!user.roles.includes(requiredRole)) {
      throw new Error("You do not have permission to clear this indicator.");
    }

    const { db } = await import("@/db/client.server");
    const { notifications } = await import("@/db/schema");
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, user.id),
          isNull(notifications.readAt),
          like(notifications.target, `${data.target}%`),
        ),
      );
    return { target: data.target };
  });

export const getWorkspaceSidebarBadges = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/services/auth/auth-server");
  const user = await requireUser();
  const { db } = await import("@/db/client.server");
  const { codRemittances, deliveryDisputes, farmerEarnings, notifications, orders, payments } =
    await import("@/db/schema");

  const badges: WorkspaceSidebarBadges = {};
  const numberFrom = (rows: Array<{ total: number | string }>) => Number(rows[0]?.total ?? 0);
  const unreadFor = async (target: string) =>
    numberFrom(
      await db
        .select({ total: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, user.id),
            isNull(notifications.readAt),
            like(notifications.target, `${target}%`),
          ),
        ),
    );

  if (user.roles.includes("Marketer")) {
    badges["/marketer/orders"] = numberFrom(
      await db.select({ total: count() }).from(orders).where(eq(orders.status, "pending")),
    );
    badges["/marketer/disputes"] = await unreadFor("/marketer/disputes");
    badges["/marketer/community"] = await unreadFor("/marketer/community");
  }

  if (user.roles.includes("Accounting")) {
    const unpaidOrders = numberFrom(
      await db
        .select({ total: count() })
        .from(orders)
        .leftJoin(payments, eq(payments.orderId, orders.id))
        .where(and(eq(orders.status, "sold"), isNull(payments.id))),
    );
    const submittedCod = numberFrom(
      await db
        .select({ total: count() })
        .from(codRemittances)
        .where(eq(codRemittances.status, "submitted")),
    );
    badges["/accounting/payments"] = unpaidOrders + submittedCod;
    badges["/accounting/farmer-payouts"] = numberFrom(
      await db
        .select({ total: countDistinct(farmerEarnings.receivingId) })
        .from(farmerEarnings)
        .where(eq(farmerEarnings.status, "available")),
    );
    badges["/accounting/refunds"] = numberFrom(
      await db
        .select({ total: count() })
        .from(deliveryDisputes)
        .where(eq(deliveryDisputes.refundStatus, "pending")),
    );
    badges["/accounting/community"] = await unreadFor("/accounting/community");
  }

  if (user.roles.includes("Management")) {
    badges["/management/deliveries"] = numberFrom(
      await db
        .select({ total: count() })
        .from(orders)
        .where(eq(orders.fulfillmentStatus, "ready_for_dispatch")),
    );
    badges["/management/disputes"] = numberFrom(
      await db
        .select({ total: count() })
        .from(deliveryDisputes)
        .where(inArray(deliveryDisputes.status, ["submitted", "under_review", "waiting_response"])),
    );
    badges["/management/community"] = await unreadFor("/management/community");
  }

  if (user.roles.includes("Rider")) {
    badges["/rider"] = numberFrom(
      await db
        .select({ total: count() })
        .from(orders)
        .where(
          and(
            eq(orders.assignedRiderId, user.id),
            inArray(orders.fulfillmentStatus, [
              "rider_assigned",
              "out_for_delivery",
              "delivery_failed",
              "rescheduled",
            ]),
          ),
        ),
    );
    badges["/rider/disputes"] = await unreadFor("/rider/disputes");
    badges["/rider/community"] = await unreadFor("/rider/community");
  }

  if (user.roles.includes("Farmer")) {
    badges["/farmer/receiving"] = await unreadFor("/farmer/receiving");
    badges["/farmer/earnings"] = await unreadFor("/farmer/earnings");
    badges["/farmer/community"] = await unreadFor("/farmer/community");
  }

  return badges;
});
