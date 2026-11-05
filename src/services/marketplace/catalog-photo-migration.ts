import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";

async function legacyPhotoCount() {
  const { db } = await import("@/db/client.server");
  const { products, listings, orderItems } = await import("@/db/schema");
  let count = 0;
  for (const table of [products, listings, orderItems]) {
    const [row] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(table)
      .where(sql`${table.imageUrl} LIKE 'data:image/%'`);
    count += Number(row?.count ?? 0);
  }
  return count;
}

export const getLegacyCatalogPhotoCount = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Marketer");
  return { remaining: await legacyPhotoCount() };
});

export const migrateNextCatalogPhoto = createServerFn({ method: "POST" }).handler(async () => {
  const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
  const actor = await requireRole("Marketer");
  const { db } = await import("@/db/client.server");
  const { products, listings, orderItems } = await import("@/db/schema");
  const { uploadCatalogImage } = await import("./catalog-image-storage.server");
  const tables = [products, listings, orderItems];
  for (const table of tables) {
    const [photo] = await db
      .select({ imageUrl: table.imageUrl })
      .from(table)
      .where(sql`${table.imageUrl} LIKE 'data:image/%'`)
      .limit(1);
    if (!photo?.imageUrl) continue;
    const original = photo.imageUrl;
    const imageUrl = await uploadCatalogImage(original);
    // Commit only verified Cloudinary URLs. Concurrent replacements never match the old value.
    // Each call moves one unique image and all its copies, including historical order snapshots.
    let updated = 0;
    await db.transaction(async (tx) => {
      for (const target of tables) {
        const [result] = await tx
          .update(target)
          .set({ imageUrl })
          .where(sql`BINARY ${target.imageUrl} = BINARY ${original}`);
        updated += result.affectedRows;
      }
      await writeAuditLog(actor.id, "catalog.photos.migrate", "product", null, { updated }, tx);
    });
    return { updated, remaining: await legacyPhotoCount() };
  }
  return { updated: 0, remaining: 0 };
});
