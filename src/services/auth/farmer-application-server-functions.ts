import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { securePassword } from "@/services/auth/password-policy";

const farmerRegistrationInput = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
      "Use letters, numbers, periods, underscores, or hyphens only.",
    ),
  password: securePassword,
  name: z.string().trim().min(2, "Enter your full name.").max(160),
  contact: z
    .string()
    .trim()
    .regex(/^(09\d{9}|\+639\d{9}|639\d{9})$/, "Enter a valid Philippine mobile number."),
  farmingLocation: z.string().trim().min(5, "Enter your barangay and municipality.").max(500),
});
const reviewFarmerApplicationInput = z
  .object({
    userId: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().max(1000).default(""),
  })
  .refine((data) => data.decision !== "rejected" || data.reason.length >= 5, {
    message: "Enter a rejection reason with at least 5 characters.",
    path: ["reason"],
  });

export const registerFarmer = createServerFn({ method: "POST" })
  .validator(farmerRegistrationInput)
  .handler(async ({ data }) => {
    const { consumeRateLimit, getRequestRateLimitKey, findUserByIdentifier, writeAuditLog } =
      await import("@/services/auth/auth-server");
    if (
      !(await consumeRateLimit("farmer-registration", getRequestRateLimitKey(), {
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,
        lockMs: 15 * 60 * 1000,
      }))
    )
      throw new Error("Too many applications. Please wait 15 minutes before trying again.");
    const username = data.username.toLowerCase();
    if (await findUserByIdentifier(username))
      throw new Error("That username is already in use. Please choose another one.");
    const bcrypt = (await import("bcryptjs")).default;
    const { db } = await import("@/db/client.server");
    const { farmerApplications, users } = await import("@/db/schema");
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(data.password, 12);
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id,
        username,
        email: null,
        displayName: data.name,
        contact: data.contact,
        passwordHash,
        active: false,
      });
      await tx.insert(farmerApplications).values({
        userId: id,
        farmingLocation: data.farmingLocation,
        status: "pending",
      });
      await writeAuditLog(id, "farmer.application.submit", "user", id, undefined, tx);
    });
    // No session or Farmer role is issued until Management approves the application.
    return { username, status: "pending" as const };
  });

export const getFarmerApplications = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Management");
  const { db } = await import("@/db/client.server");
  const { farmerApplications, users } = await import("@/db/schema");
  const rows = await db
    .select({
      userId: users.id,
      name: users.displayName,
      username: users.username,
      contact: users.contact,
      farmingLocation: farmerApplications.farmingLocation,
      status: farmerApplications.status,
      rejectionReason: farmerApplications.rejectionReason,
      createdAt: farmerApplications.createdAt,
      reviewedAt: farmerApplications.reviewedAt,
    })
    .from(farmerApplications)
    .innerJoin(users, eq(farmerApplications.userId, users.id))
    .orderBy(asc(farmerApplications.createdAt), asc(farmerApplications.userId));
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  }));
});

export const reviewFarmerApplication = createServerFn({ method: "POST" })
  .validator(reviewFarmerApplicationInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { farmerApplications, roles, userRoles, users } = await import("@/db/schema");
    await db.transaction(async (tx) => {
      const [application] = await tx
        .select()
        .from(farmerApplications)
        .where(eq(farmerApplications.userId, data.userId))
        .for("update");
      if (!application || application.status !== "pending")
        throw new Error("This application has already been reviewed or could not be found.");
      if (data.decision === "approved") {
        const [role] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.name, "Farmer"));
        if (!role) throw new Error("The Farmer role is not configured.");
        await tx.insert(userRoles).values({ userId: data.userId, roleId: role.id });
        await tx.update(users).set({ active: true }).where(eq(users.id, data.userId));
      }
      await tx
        .update(farmerApplications)
        .set({
          status: data.decision,
          rejectionReason: data.decision === "rejected" ? data.reason : null,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        })
        .where(eq(farmerApplications.userId, data.userId));
      await writeAuditLog(
        actor.id,
        "farmer.application." + data.decision,
        "user",
        data.userId,
        { reason: data.decision === "rejected" ? data.reason : null },
        tx,
      );
    });
    return { status: data.decision };
  });
