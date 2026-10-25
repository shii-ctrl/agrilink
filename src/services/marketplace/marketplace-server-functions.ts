// Server functions are client-safe RPC stubs; their handlers stay on the server.
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Classification, Product } from "@/features/marketplace/products";
import { procyMarketCategories } from "@/features/marketplace/procy-market-categories";
import type { DemoOrder } from "@/lib/demo/demo-orders";

const listingInput = z.object({ listingId: z.string().uuid() });
const orderNumberInput = z.object({ orderNumber: z.string().trim().min(3).max(40) });
const checkoutInput = z.object({
  contact: z.string().trim().min(5).max(80),
  pickupNote: z.string().trim().min(3).max(2000),
  items: z
    .array(z.object({ listingId: z.string().uuid(), quantityKg: z.number().positive().max(10000) }))
    .min(1)
    .max(20),
});
const cartItemInput = z.object({
  listingId: z.string().uuid(),
  quantityKg: z.number().positive().max(10_000),
});
const setCartItemInput = z.object({
  listingId: z.string().uuid(),
  quantityKg: z.number().min(0).max(10_000),
});
const workflowActionInput = z.object({
  orderNumber: z.string().trim().min(3).max(40),
});
const paymentInput = workflowActionInput.extend({
  method: z.enum(["cash", "cash_on_delivery"]),
});
const releaseOrderInput = workflowActionInput.extend({
  outcome: z.enum(["cancelled", "rejected"]),
  reason: z.string().trim().min(3).max(500).optional(),
});
const dailyPriceInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  listingId: z.string().uuid(),
  price: z.number().positive().max(100000),
});
const dailyPriceStatusInput = z.object({
  id: z.string().uuid(),
  published: z.boolean(),
});
const listingPricingFields = {
  retailPricePerKg: z.number().positive().max(100_000),
  bundlePricePerKg: z.number().positive().max(100_000).nullable(),
  bundleMinimumKg: z.number().positive().max(10_000).nullable(),
};

const createListingInput = z
  .object({
    inventoryId: z.string().uuid(),
    ...listingPricingFields,
    status: z.enum(["draft", "published"]).default("draft"),
  })
  .superRefine(validateBundlePricing);
const updateListingPricingInput = z
  .object({ listingId: z.string().uuid(), ...listingPricingFields })
  .superRefine(validateBundlePricing);
const listingStatusInput = z.object({
  listingId: z.string().uuid(),
  status: z.enum(["draft", "published", "archived"]),
});
function validateBundlePricing(
  data: {
    retailPricePerKg: number;
    bundlePricePerKg: number | null;
    bundleMinimumKg: number | null;
  },
  context: z.RefinementCtx,
) {
  const hasBundlePrice = data.bundlePricePerKg !== null;
  const hasBundleMinimum = data.bundleMinimumKg !== null;
  if (hasBundlePrice !== hasBundleMinimum) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter both bundle price and minimum quantity, or leave both blank.",
      path: hasBundlePrice ? ["bundleMinimumKg"] : ["bundlePricePerKg"],
    });
  }
  if (hasBundlePrice && data.bundlePricePerKg! >= data.retailPricePerKg) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Bundle price must be lower than the retail price.",
      path: ["bundlePricePerKg"],
    });
  }
}
const cropTypes = procyMarketCategories;

const createCatalogProductInput = z.object({
  name: z.string().trim().min(2).max(160),
  cropType: z.enum(cropTypes),
  description: z
    .string()
    .trim()
    .max(2000)
    .refine(
      (value) => value.length === 0 || value.length >= 4,
      "Description must contain at least 4 characters when provided.",
    )
    .optional(),
  imageDataUrl: z
    .string()
    .trim()
    .max(2_500_000, "Choose an image smaller than 1.8 MB.")
    .refine(
      (value) =>
        value === "" || /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value),
      "Choose a JPG, PNG, or WebP image.",
    )
    .optional()
    .or(z.literal("")),
});

const updateCatalogProductImageInput = z.object({
  productId: z.string().uuid(),
  imageDataUrl: z
    .string()
    .trim()
    .min(1, "Choose a product image.")
    .max(2_500_000, "Choose an image smaller than 1.8 MB.")
    .refine(
      (value) => /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value),
      "Choose a JPG, PNG, or WebP image.",
    ),
});

function hasImageSignature(image: Buffer, contentType: "jpeg" | "png" | "webp") {
  if (contentType === "jpeg")
    return image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  if (contentType === "png")
    return (
      image.length >= 8 &&
      image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  return (
    image.length >= 12 &&
    image.subarray(0, 4).toString("ascii") === "RIFF" &&
    image.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function assertSafeProductImage(dataUrl: string | undefined) {
  if (!dataUrl) return;
  const match = /^data:image\/(jpeg|png|webp);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error("Choose a JPG, PNG, or WebP image.");
  const [, contentType, encodedImage] = match;
  if (!contentType || !encodedImage) throw new Error("Choose a JPG, PNG, or WebP image.");
  const image = Buffer.from(encodedImage.replaceAll(/\s/g, ""), "base64");
  if (
    !image.length ||
    image.length > 1_800_000 ||
    !hasImageSignature(image, contentType.toLowerCase() as "jpeg" | "png" | "webp")
  ) {
    throw new Error("Choose a valid JPG, PNG, or WebP image smaller than 1.8 MB.");
  }
}

type MarketplaceProduct = Product;
type MarketerMarketplaceProduct = MarketplaceProduct & {
  farmer: string | null;
  status: "draft" | "published" | "unavailable" | "archived";
};

function asProduct(row: {
  listingId: string;
  name: string;
  cropType: string;
  classification: string;
  pricePerKg: string;
  retailPricePerKg: string | null;
  bundlePricePerKg: string | null;
  bundleMinimumKg: string | null;
  availableKg: string;
  description: string | null;
  imageUrl: string | null;
}): MarketplaceProduct {
  const retailPricePerKg = Number(row.retailPricePerKg ?? row.pricePerKg);
  const bundlePricePerKg =
    row.bundlePricePerKg === null || row.bundleMinimumKg === null
      ? null
      : Number(row.bundlePricePerKg);
  const bundleMinimumKg = bundlePricePerKg === null ? null : Number(row.bundleMinimumKg);
  return {
    id: row.listingId,
    name: row.name,
    cropType: row.cropType,
    classification: row.classification as Classification,
    pricePerKg: retailPricePerKg,
    retailPricePerKg,
    bundlePricePerKg,
    bundleMinimumKg,
    quantityKg: Math.max(0, Number(row.availableKg)),
    description:
      row.description ??
      `${row.name} supplied by PROCY farmer members and classified ${row.classification}.`,
    image: row.imageUrl ?? "",
  };
}

function listingUnitPrice(
  row: {
    pricePerKg: string;
    retailPricePerKg: string | null;
    bundlePricePerKg: string | null;
    bundleMinimumKg: string | null;
  },
  quantityKg: number,
) {
  const retailPricePerKg = Number(row.retailPricePerKg ?? row.pricePerKg);
  const bundleMinimumKg = Number(row.bundleMinimumKg ?? 0);
  const bundlePricePerKg = Number(row.bundlePricePerKg ?? 0);
  return bundleMinimumKg > 0 && bundlePricePerKg > 0 && quantityKg >= bundleMinimumKg
    ? bundlePricePerKg
    : retailPricePerKg;
}

async function fetchListings(listingId?: string) {
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, listings, products } = await import("@/db/schema");
  const where = listingId
    ? and(eq(listings.status, "published"), eq(listings.id, listingId))
    : eq(listings.status, "published");
  const rows = await db
    .select({
      listingId: listings.id,
      name: products.name,
      cropType: products.cropType,
      classification: classifications.name,
      pricePerKg: listings.pricePerKg,
      retailPricePerKg: listings.retailPricePerKg,
      bundlePricePerKg: listings.bundlePricePerKg,
      bundleMinimumKg: listings.bundleMinimumKg,
      availableKg: sql<string>`${inventory.quantityKg} - ${inventory.reservedKg}`,
      description: products.description,
      imageUrl: products.imageUrl,
    })
    .from(listings)
    .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
    .where(where);
  return rows.map(asProduct);
}

async function fetchMarketerListings(): Promise<MarketerMarketplaceProduct[]> {
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, listings, products, users } = await import("@/db/schema");
  const rows = await db
    .select({
      listingId: listings.id,
      name: products.name,
      cropType: products.cropType,
      classification: classifications.name,
      pricePerKg: listings.pricePerKg,
      retailPricePerKg: listings.retailPricePerKg,
      bundlePricePerKg: listings.bundlePricePerKg,
      bundleMinimumKg: listings.bundleMinimumKg,
      availableKg: sql<string>`${inventory.quantityKg} - ${inventory.reservedKg}`,
      description: products.description,
      imageUrl: products.imageUrl,
      farmer: users.displayName,
      status: listings.status,
    })
    .from(listings)
    .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
    .leftJoin(users, eq(inventory.farmerId, users.id));
  return rows.map((row) => ({ ...asProduct(row), farmer: row.farmer, status: row.status }));
}

export const getMarketplaceListings = createServerFn({ method: "GET" }).handler(async () =>
  fetchListings(),
);

export const getMarketerMarketplaceListings = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireRole } = await import("@/services/auth/auth-server");
    await requireRole("Marketer");
    return fetchMarketerListings();
  },
);

export const createCatalogProduct = createServerFn({ method: "POST" })
  .validator(createCatalogProductInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    assertSafeProductImage(data.imageDataUrl);
    const { db } = await import("@/db/client.server");
    const { products } = await import("@/db/schema");
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(sql`LOWER(${products.name}) = LOWER(${data.name})`);
    if (existing) {
      throw new Error("A catalog product with that name already exists.");
    }
    const id = crypto.randomUUID();
    await db.insert(products).values({
      id,
      name: data.name,
      cropType: data.cropType,
      ...(data.description ? { description: data.description } : {}),
      ...(data.imageDataUrl ? { imageUrl: data.imageDataUrl } : {}),
    });
    await writeAuditLog(actor.id, "product.catalog_create", "product", id, { name: data.name });
    return { id };
  });

export const updateCatalogProductImage = createServerFn({ method: "POST" })
  .validator(updateCatalogProductImageInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    assertSafeProductImage(data.imageDataUrl);
    const { db } = await import("@/db/client.server");
    const { products } = await import("@/db/schema");
    const [product] = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.id, data.productId), eq(products.active, true)));
    if (!product) throw new Error("This catalog product is no longer available.");

    await db
      .update(products)
      .set({ imageUrl: data.imageDataUrl })
      .where(eq(products.id, product.id));
    await writeAuditLog(actor.id, "product.catalog_image_update", "product", product.id, {
      name: product.name,
    });
    return { id: product.id };
  });

export const getCatalogProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Marketer");
  const { db } = await import("@/db/client.server");
  const { products } = await import("@/db/schema");
  return db
    .select({
      id: products.id,
      name: products.name,
      cropType: products.cropType,
      description: products.description,
      imageUrl: products.imageUrl,
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.name));
});

export const getPublishableInventory = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Marketer");
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, listings, products, users } = await import("@/db/schema");
  return db
    .select({
      id: inventory.id,
      name: products.name,
      cropType: products.cropType,
      classification: classifications.name,
      quantityKg: inventory.quantityKg,
      farmer: users.displayName,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
    .leftJoin(users, eq(inventory.farmerId, users.id))
    .leftJoin(listings, eq(listings.inventoryId, inventory.id))
    .where(and(sql`${inventory.quantityKg} > 0`, sql`${listings.id} IS NULL`));
});

export const createMarketplaceListing = createServerFn({ method: "POST" })
  .validator(createListingInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { inventory, listings } = await import("@/db/schema");
    const created = await db.transaction(async (tx) => {
      const [stock] = await tx
        .select({ id: inventory.id, quantityKg: inventory.quantityKg })
        .from(inventory)
        .where(eq(inventory.id, data.inventoryId));
      if (!stock || Number(stock.quantityKg) <= 0)
        throw new Error("Select classified inventory created from a saved delivery.");
      const [existing] = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.inventoryId, data.inventoryId));
      if (existing)
        throw new Error("This classified inventory group already has a marketplace listing.");
      const listingId = crypto.randomUUID();
      await tx.insert(listings).values({
        id: listingId,
        inventoryId: data.inventoryId,
        // price_per_kg remains the retail fallback for older reports and existing integrations.
        pricePerKg: data.retailPricePerKg.toFixed(2),
        retailPricePerKg: data.retailPricePerKg.toFixed(2),
        bundlePricePerKg: data.bundlePricePerKg === null ? null : data.bundlePricePerKg.toFixed(2),
        bundleMinimumKg: data.bundleMinimumKg === null ? null : data.bundleMinimumKg.toFixed(2),
        status: data.status,
      });
      return { listingId, inventoryId: data.inventoryId };
    });
    await writeAuditLog(actor.id, "listing.create", "marketplace_listing", created.listingId, {
      inventoryId: created.inventoryId,
    });
    return created;
  });

export const updateMarketplaceListingPricing = createServerFn({ method: "POST" })
  .validator(updateListingPricingInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { listings } = await import("@/db/schema");
    const [updated] = await db
      .update(listings)
      .set({
        pricePerKg: data.retailPricePerKg.toFixed(2),
        retailPricePerKg: data.retailPricePerKg.toFixed(2),
        bundlePricePerKg: data.bundlePricePerKg === null ? null : data.bundlePricePerKg.toFixed(2),
        bundleMinimumKg: data.bundleMinimumKg === null ? null : data.bundleMinimumKg.toFixed(2),
      })
      .where(eq(listings.id, data.listingId));
    if (updated.affectedRows !== 1) throw new Error("The marketplace listing could not be found.");
    await writeAuditLog(actor.id, "listing.pricing.update", "marketplace_listing", data.listingId, {
      retailPricePerKg: data.retailPricePerKg,
      bundlePricePerKg: data.bundlePricePerKg,
      bundleMinimumKg: data.bundleMinimumKg,
    });
    return { id: data.listingId };
  });

export const setMarketplaceListingStatus = createServerFn({ method: "POST" })
  .validator(listingStatusInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { inventory, listings, products } = await import("@/db/schema");
    const [listing] = await db
      .select({
        availableKg: sql<string>`${inventory.quantityKg} - ${inventory.reservedKg}`,
        productName: products.name,
      })
      .from(listings)
      .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(eq(listings.id, data.listingId));
    if (!listing) throw new Error("The marketplace listing could not be found.");
    if (data.status === "published") {
      if (Number(listing.availableKg) <= 0) {
        throw new Error("Only listings with available stock can be published.");
      }
    }
    const [updated] = await db
      .update(listings)
      .set({ status: data.status })
      .where(eq(listings.id, data.listingId));
    if (updated.affectedRows !== 1) throw new Error("The marketplace listing could not be found.");
    await writeAuditLog(actor.id, "listing.status.update", "marketplace_listing", data.listingId, {
      status: data.status,
    });
    const { notifyCartHoldersForListing, notifyRole } =
      await import("@/services/messaging/notification-server");
    if (data.status === "published") {
      await notifyRole("Buyer", {
        title: "New marketplace listing",
        message: `${listing.productName} is now available in the PROCY marketplace.`,
        target: "/marketplace",
      });
    } else {
      await notifyCartHoldersForListing(data.listingId, {
        title: "Marketplace listing changed",
        message: `${listing.productName} is no longer available. Review your cart before ordering.`,
        target: "/buyer/cart",
      });
    }
    return { id: data.listingId, status: data.status };
  });

export const getMarketplaceListing = createServerFn({ method: "GET" })
  .validator(listingInput)
  .handler(async ({ data }) => {
    const [listing] = await fetchListings(data.listingId);
    return listing ?? null;
  });

async function fetchDailyPrices(publicOnly: boolean) {
  const { db } = await import("@/db/client.server");
  const { classifications, dailyPrices, inventory, listings, products } =
    await import("@/db/schema");
  const rows = await db
    .select({
      id: dailyPrices.id,
      listingId: dailyPrices.listingId,
      date: sql<string>`DATE(${dailyPrices.priceDate})`,
      product: products.name,
      cropType: products.cropType,
      classification: classifications.name,
      price: dailyPrices.price,
      published: dailyPrices.published,
    })
    .from(dailyPrices)
    .innerJoin(listings, eq(dailyPrices.listingId, listings.id))
    .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
    // A public price is only meaningful while its listing is buyer-visible and
    // has stock that can still be purchased. Marketers retain the full history
    // (including hidden, archived, and sold-out listing prices) in their view.
    .where(
      publicOnly
        ? and(
            eq(dailyPrices.published, true),
            eq(listings.status, "published"),
            sql`${inventory.quantityKg} - ${inventory.reservedKg} > 0`,
          )
        : undefined,
    )
    .orderBy(asc(dailyPrices.priceDate));
  return rows.map((row) => ({
    ...row,
    classification: row.classification as Classification,
    price: Number(row.price),
    status: row.published ? ("Published" as const) : ("Hidden" as const),
  }));
}

export const getPublicDailyPrices = createServerFn({ method: "GET" }).handler(async () =>
  fetchDailyPrices(true),
);

export const getMarketerDailyPrices = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Marketer");
  return fetchDailyPrices(false);
});

export const publishDailyPrice = createServerFn({ method: "POST" })
  .validator(dailyPriceInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { dailyPrices, inventory, listings, products } = await import("@/db/schema");
    const [listing] = await db
      .select({ id: listings.id, status: listings.status, productName: products.name })
      .from(listings)
      .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(eq(listings.id, data.listingId));
    if (!listing || listing.status !== "published") {
      throw new Error("Choose a currently published marketplace listing.");
    }
    const [existing] = await db
      .select({ id: dailyPrices.id })
      .from(dailyPrices)
      .where(
        and(
          eq(dailyPrices.listingId, data.listingId),
          sql`DATE(${dailyPrices.priceDate}) = ${data.date}`,
        ),
      );
    if (existing) {
      await db
        .update(dailyPrices)
        .set({ price: data.price.toFixed(2), published: true, createdById: actor.id })
        .where(eq(dailyPrices.id, existing.id));
      await writeAuditLog(actor.id, "daily_price.update", "daily_price", existing.id, data);
      const { notifyRole } = await import("@/services/messaging/notification-server");
      await notifyRole("Buyer", {
        title: "Daily price updated",
        message: `${listing.productName} is now ₱${data.price.toFixed(2)} per kg for ${data.date}.`,
        target: "/daily-prices",
      });
      return { id: existing.id, updated: true };
    }
    const id = crypto.randomUUID();
    await db.insert(dailyPrices).values({
      id,
      listingId: data.listingId,
      price: data.price.toFixed(2),
      priceDate: new Date(`${data.date}T00:00:00`),
      published: true,
      createdById: actor.id,
    });
    await writeAuditLog(actor.id, "daily_price.publish", "daily_price", id, data);
    const { notifyRole } = await import("@/services/messaging/notification-server");
    await notifyRole("Buyer", {
      title: "New daily price",
      message: `${listing.productName} is ₱${data.price.toFixed(2)} per kg for ${data.date}.`,
      target: "/daily-prices",
    });
    return { id, updated: false };
  });

export const setDailyPricePublished = createServerFn({ method: "POST" })
  .validator(dailyPriceStatusInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { dailyPrices, inventory, listings, products } = await import("@/db/schema");
    const [dailyPrice] = await db
      .select({ productName: products.name })
      .from(dailyPrices)
      .innerJoin(listings, eq(dailyPrices.listingId, listings.id))
      .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(eq(dailyPrices.id, data.id));
    if (!dailyPrice) throw new Error("The daily price could not be found.");
    const [result] = await db
      .update(dailyPrices)
      .set({ published: data.published })
      .where(eq(dailyPrices.id, data.id));
    if (result.affectedRows !== 1) throw new Error("The daily price could not be found.");
    await writeAuditLog(actor.id, "daily_price.visibility", "daily_price", data.id, data);
    const { notifyRole } = await import("@/services/messaging/notification-server");
    await notifyRole("Buyer", {
      title: data.published ? "Daily price published" : "Daily price hidden",
      message: data.published
        ? `${dailyPrice.productName}'s daily price is now available to view.`
        : `${dailyPrice.productName}'s daily price is no longer publicly available.`,
      target: "/daily-prices",
    });
    return { id: data.id, published: data.published };
  });

async function buyerCartRows(buyerId: string) {
  const { db } = await import("@/db/client.server");
  const { cartItems, carts, classifications, inventory, listings, products } =
    await import("@/db/schema");
  const rows = await db
    .select({
      id: listings.id,
      name: products.name,
      classification: classifications.name,
      pricePerKg: listings.pricePerKg,
      retailPricePerKg: listings.retailPricePerKg,
      bundlePricePerKg: listings.bundlePricePerKg,
      bundleMinimumKg: listings.bundleMinimumKg,
      quantityKg: cartItems.quantityKg,
      availableKg: sql<string>`${inventory.quantityKg} - ${inventory.reservedKg}`,
      imageUrl: products.imageUrl,
    })
    .from(carts)
    .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
    .innerJoin(listings, eq(cartItems.listingId, listings.id))
    .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
    .where(eq(carts.buyerId, buyerId));
  return rows.map((row) => {
    const quantityKg = Number(row.quantityKg);
    const retailPricePerKg = Number(row.retailPricePerKg ?? row.pricePerKg);
    const bundlePricePerKg =
      row.bundlePricePerKg === null || row.bundleMinimumKg === null
        ? null
        : Number(row.bundlePricePerKg);
    const bundleMinimumKg = bundlePricePerKg === null ? null : Number(row.bundleMinimumKg);
    return {
      ...row,
      classification: row.classification as Classification,
      pricePerKg: listingUnitPrice(row, quantityKg),
      retailPricePerKg,
      bundlePricePerKg,
      bundleMinimumKg,
      quantityKg,
      availableKg: Math.max(0, Number(row.availableKg)),
    };
  });
}

/**
 * Cart items now reserve stock immediately. The movement row also lets existing
 * carts created before this behaviour be safely reserved once, without reserving
 * them again on every cart refresh.
 */
async function reserveExistingBuyerCartStock(buyerId: string) {
  const { db } = await import("@/db/client.server");
  const { cartItems, carts, inventory, inventoryMovements, listings } = await import("@/db/schema");

  await db.transaction(async (tx) => {
    // The same Buyer page can load the cart button and product details together.
    // Locking the cart first prevents both requests from reserving a legacy item.
    await tx.select({ id: carts.id }).from(carts).where(eq(carts.buyerId, buyerId)).for("update");
    const unreservedItems = await tx
      .select({
        cartItemId: cartItems.id,
        inventoryId: inventory.id,
        quantityKg: cartItems.quantityKg,
        stockKg: inventory.quantityKg,
        reservedKg: inventory.reservedKg,
      })
      .from(carts)
      .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
      .innerJoin(listings, eq(cartItems.listingId, listings.id))
      .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
      .leftJoin(
        inventoryMovements,
        and(
          eq(inventoryMovements.referenceType, "cart"),
          eq(inventoryMovements.referenceId, cartItems.id),
          eq(inventoryMovements.movementType, "reservation"),
        ),
      )
      .where(and(eq(carts.buyerId, buyerId), isNull(inventoryMovements.id)))
      .for("update");

    for (const item of unreservedItems) {
      const availableKg = Math.max(0, Number(item.stockKg) - Number(item.reservedKg));
      const reservableKg = Math.min(Number(item.quantityKg), availableKg);
      if (reservableKg <= 0) {
        await tx.delete(cartItems).where(eq(cartItems.id, item.cartItemId));
        continue;
      }

      const [reserved] = await tx
        .update(inventory)
        .set({ reservedKg: sql`${inventory.reservedKg} + ${reservableKg}` })
        .where(
          and(
            eq(inventory.id, item.inventoryId),
            sql`${inventory.quantityKg} - ${inventory.reservedKg} >= ${reservableKg}`,
          ),
        );
      if (reserved.affectedRows !== 1) continue;

      if (reservableKg < Number(item.quantityKg)) {
        await tx
          .update(cartItems)
          .set({ quantityKg: reservableKg.toFixed(2) })
          .where(eq(cartItems.id, item.cartItemId));
      }
      await tx.insert(inventoryMovements).values({
        id: crypto.randomUUID(),
        inventoryId: item.inventoryId,
        movementType: "reservation",
        reservedChangeKg: reservableKg.toFixed(2),
        referenceType: "cart",
        referenceId: item.cartItemId,
        recordedById: buyerId,
        note: "Reserved in buyer cart.",
      });
    }
  });
}

export const getBuyerCart = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const buyer = await requireRole("Buyer");
  await reserveExistingBuyerCartStock(buyer.id);
  return buyerCartRows(buyer.id);
});

export const addBuyerCartItem = createServerFn({ method: "POST" })
  .validator(cartItemInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("@/services/auth/auth-server");
    const buyer = await requireRole("Buyer");
    await reserveExistingBuyerCartStock(buyer.id);
    const { db } = await import("@/db/client.server");
    const { cartItems, carts, inventory, inventoryMovements, listings } =
      await import("@/db/schema");
    await db.transaction(async (tx) => {
      const [listing] = await tx
        .select({
          id: listings.id,
          inventoryId: inventory.id,
          quantityKg: inventory.quantityKg,
          reservedKg: inventory.reservedKg,
        })
        .from(listings)
        .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
        .where(and(eq(listings.id, data.listingId), eq(listings.status, "published")));
      if (!listing) throw new Error("This listing is no longer available.");
      const availableKg = Number(listing.quantityKg) - Number(listing.reservedKg);
      if (data.quantityKg > availableKg) {
        throw new Error(`Only ${availableKg} kg is currently available.`);
      }
      const proposedCartId = crypto.randomUUID();
      await tx
        .insert(carts)
        .values({ id: proposedCartId, buyerId: buyer.id })
        .onDuplicateKeyUpdate({ set: { buyerId: sql`${carts.buyerId}` } });
      const [cart] = await tx
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.buyerId, buyer.id));
      if (!cart) throw new Error("Your cart could not be prepared.");
      const [existing] = await tx
        .select({ id: cartItems.id, quantityKg: cartItems.quantityKg })
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
      const nextQuantity = Number(existing?.quantityKg ?? 0) + data.quantityKg;
      if (data.quantityKg > availableKg) {
        throw new Error(`Only ${availableKg} kg is currently available.`);
      }
      const cartItemId = existing?.id ?? crypto.randomUUID();
      if (existing) {
        await tx
          .update(cartItems)
          .set({ quantityKg: nextQuantity.toFixed(2) })
          .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
      } else {
        await tx.insert(cartItems).values({
          id: cartItemId,
          cartId: cart.id,
          listingId: data.listingId,
          quantityKg: data.quantityKg.toFixed(2),
        });
      }
      const [reservation] = await tx
        .update(inventory)
        .set({ reservedKg: sql`${inventory.reservedKg} + ${data.quantityKg}` })
        .where(
          and(
            eq(inventory.id, listing.inventoryId),
            sql`${inventory.quantityKg} - ${inventory.reservedKg} >= ${data.quantityKg}`,
          ),
        );
      if (reservation.affectedRows !== 1) {
        throw new Error("Stock changed before your cart could be updated. Please try again.");
      }
      await tx.insert(inventoryMovements).values({
        id: crypto.randomUUID(),
        inventoryId: listing.inventoryId,
        movementType: "reservation",
        reservedChangeKg: data.quantityKg.toFixed(2),
        referenceType: "cart",
        referenceId: cartItemId,
        recordedById: buyer.id,
        note: "Reserved in buyer cart.",
      });
    });
    return buyerCartRows(buyer.id);
  });

export const setBuyerCartItem = createServerFn({ method: "POST" })
  .validator(setCartItemInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("@/services/auth/auth-server");
    const buyer = await requireRole("Buyer");
    await reserveExistingBuyerCartStock(buyer.id);
    const { db } = await import("@/db/client.server");
    const { cartItems, carts, inventory, inventoryMovements, listings } =
      await import("@/db/schema");
    await db.transaction(async (tx) => {
      const [cart] = await tx
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.buyerId, buyer.id));
      if (!cart) return;
      const [existing] = await tx
        .select({ id: cartItems.id, quantityKg: cartItems.quantityKg })
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
      if (!existing) throw new Error("That item is no longer in your cart.");
      const [listing] = await tx
        .select({
          inventoryId: inventory.id,
          quantityKg: inventory.quantityKg,
          reservedKg: inventory.reservedKg,
        })
        .from(listings)
        .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
        .where(eq(listings.id, data.listingId));
      if (!listing) throw new Error("That listing is no longer available.");
      const currentQuantityKg = Number(existing.quantityKg);
      if (data.quantityKg === 0) {
        const [released] = await tx
          .update(inventory)
          .set({ reservedKg: sql`${inventory.reservedKg} - ${currentQuantityKg}` })
          .where(
            and(
              eq(inventory.id, listing.inventoryId),
              sql`${inventory.reservedKg} >= ${currentQuantityKg}`,
            ),
          );
        if (released.affectedRows !== 1) {
          throw new Error(
            "Reserved stock is inconsistent, so this cart item could not be removed.",
          );
        }
        await tx
          .delete(cartItems)
          .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
        await tx.insert(inventoryMovements).values({
          id: crypto.randomUUID(),
          inventoryId: listing.inventoryId,
          movementType: "release",
          reservedChangeKg: `-${currentQuantityKg.toFixed(2)}`,
          referenceType: "cart",
          referenceId: existing.id,
          recordedById: buyer.id,
          note: "Removed from buyer cart.",
        });
        return;
      }
      const differenceKg = data.quantityKg - currentQuantityKg;
      if (differenceKg > 0) {
        const [reserved] = await tx
          .update(inventory)
          .set({ reservedKg: sql`${inventory.reservedKg} + ${differenceKg}` })
          .where(
            and(
              eq(inventory.id, listing.inventoryId),
              sql`${inventory.quantityKg} - ${inventory.reservedKg} >= ${differenceKg}`,
            ),
          );
        if (reserved.affectedRows !== 1) {
          const availableKg = Math.max(0, Number(listing.quantityKg) - Number(listing.reservedKg));
          throw new Error(`Only ${availableKg} kg is currently available.`);
        }
      } else if (differenceKg < 0) {
        const [released] = await tx
          .update(inventory)
          .set({ reservedKg: sql`${inventory.reservedKg} + ${differenceKg}` })
          .where(
            and(
              eq(inventory.id, listing.inventoryId),
              sql`${inventory.reservedKg} >= ${Math.abs(differenceKg)}`,
            ),
          );
        if (released.affectedRows !== 1) {
          throw new Error(
            "Reserved stock is inconsistent, so this cart item could not be updated.",
          );
        }
      }
      const [updated] = await tx
        .update(cartItems)
        .set({ quantityKg: data.quantityKg.toFixed(2) })
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
      if (updated.affectedRows !== 1) throw new Error("That item is no longer in your cart.");
      if (differenceKg !== 0) {
        await tx.insert(inventoryMovements).values({
          id: crypto.randomUUID(),
          inventoryId: listing.inventoryId,
          movementType: differenceKg > 0 ? "reservation" : "release",
          reservedChangeKg: differenceKg.toFixed(2),
          referenceType: "cart",
          referenceId: existing.id,
          recordedById: buyer.id,
          note:
            differenceKg > 0
              ? "Increased buyer cart reservation."
              : "Reduced buyer cart reservation.",
        });
      }
    });
    return buyerCartRows(buyer.id);
  });

export const placeBuyerOrder = createServerFn({ method: "POST" })
  .validator(checkoutInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const buyer = await requireRole("Buyer");
    await reserveExistingBuyerCartStock(buyer.id);
    const { db } = await import("@/db/client.server");
    const {
      inventory,
      listings,
      orders,
      orderItems,
      orderStatusHistory,
      products,
      classifications,
      cartItems,
      carts,
    } = await import("@/db/schema");

    const createdOrder = await db.transaction(async (tx) => {
      const requestedItems = Array.from(
        data.items.reduce((requested, item) => {
          requested.set(item.listingId, (requested.get(item.listingId) ?? 0) + item.quantityKg);
          return requested;
        }, new Map<string, number>()),
        ([listingId, quantityKg]) => ({ listingId, quantityKg }),
      );
      const listingIds = requestedItems.map((item) => item.listingId);
      const [cart] = await tx
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.buyerId, buyer.id));
      if (!cart) throw new Error("Your cart is empty. Add items before placing an order.");
      const cartLines = await tx
        .select({ listingId: cartItems.listingId, quantityKg: cartItems.quantityKg })
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), inArray(cartItems.listingId, listingIds)));
      if (
        cartLines.length !== requestedItems.length ||
        requestedItems.some(
          (item) =>
            Number(cartLines.find((line) => line.listingId === item.listingId)?.quantityKg) !==
            item.quantityKg,
        )
      ) {
        throw new Error("Your cart changed. Refresh it before placing the order.");
      }
      const rows = await tx
        .select({
          listingId: listings.id,
          inventoryId: inventory.id,
          name: products.name,
          classification: classifications.name,
          pricePerKg: listings.pricePerKg,
          retailPricePerKg: listings.retailPricePerKg,
          bundlePricePerKg: listings.bundlePricePerKg,
          bundleMinimumKg: listings.bundleMinimumKg,
          quantityKg: inventory.quantityKg,
          reservedKg: inventory.reservedKg,
        })
        .from(listings)
        .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
        .innerJoin(products, eq(inventory.productId, products.id))
        .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
        .where(and(eq(listings.status, "published"), inArray(listings.id, listingIds)));

      if (rows.length !== requestedItems.length) {
        throw new Error("One or more selected listings are no longer available.");
      }

      const orderId = crypto.randomUUID();
      const orderNumber = `ORD-${new Date().getFullYear()}-${orderId.slice(0, 8).toUpperCase()}`;
      let totalAmount = 0;
      for (const item of requestedItems) {
        const row = rows.find((candidate) => candidate.listingId === item.listingId);
        if (!row) throw new Error("A selected listing could not be found.");
        if (item.quantityKg > Number(row.reservedKg)) {
          throw new Error(
            `${row.name} (${row.classification}) no longer has enough reserved stock. Refresh your cart.`,
          );
        }
        totalAmount += item.quantityKg * listingUnitPrice(row, item.quantityKg);
      }

      await tx.insert(orders).values({
        id: orderId,
        orderNumber,
        buyerId: buyer.id,
        status: "pending",
        contact: data.contact,
        pickupNote: data.pickupNote,
        totalAmount: totalAmount.toFixed(2),
      });

      for (const item of requestedItems) {
        const row = rows.find((candidate) => candidate.listingId === item.listingId);
        if (!row) continue;
        await tx.insert(orderItems).values({
          id: crypto.randomUUID(),
          orderId,
          listingId: item.listingId,
          quantityKg: item.quantityKg.toFixed(2),
          pricePerKg: listingUnitPrice(row, item.quantityKg).toFixed(2),
        });
      }

      await tx.insert(orderStatusHistory).values({
        id: crypto.randomUUID(),
        orderId,
        status: "pending",
        changedById: buyer.id,
        note: "Buyer submitted the order.",
        changedAt: new Date(),
      });

      await tx
        .delete(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), inArray(cartItems.listingId, listingIds)));

      await writeAuditLog(buyer.id, "order.create", "order", orderId, { orderNumber });
      return { id: orderId, orderNumber, totalAmount, buyerName: buyer.displayName };
    });
    const { notifyRole } = await import("@/services/messaging/notification-server");
    await notifyRole("Marketer", {
      title: "New buyer order",
      message: `${buyer.displayName} submitted ${createdOrder.orderNumber} for review.`,
      target: "/marketer/orders",
    });
    return createdOrder;
  });

export const getBuyerOrders = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const buyer = await requireRole("Buyer");
  const { db } = await import("@/db/client.server");
  const { orders, payments } = await import("@/db/schema");
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalAmount: orders.totalAmount,
      contact: orders.contact,
      pickupNote: orders.pickupNote,
      createdAt: orders.createdAt,
      paymentId: payments.paymentNumber,
    })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(eq(orders.buyerId, buyer.id))
    .orderBy(desc(orders.createdAt), desc(orders.id));
  return rows.map((row) => ({
    ...row,
    totalAmount: Number(row.totalAmount),
    paymentStatus: row.paymentId ? "Paid" : "Unpaid",
  }));
});

export const rebuildBuyerCartFromOrder = createServerFn({ method: "POST" })
  .validator(orderNumberInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const buyer = await requireRole("Buyer");
    await reserveExistingBuyerCartStock(buyer.id);
    const { db } = await import("@/db/client.server");
    const { cartItems, carts, inventory, inventoryMovements, listings, orderItems, orders } =
      await import("@/db/schema");
    const [order] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(and(eq(orders.orderNumber, data.orderNumber), eq(orders.buyerId, buyer.id)));
    if (!order) throw new Error("This order could not be found.");
    if (order.status !== "sold") throw new Error("Only completed orders can be added again.");

    const originalItems = await db
      .select({ listingId: orderItems.listingId, quantityKg: orderItems.quantityKg })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const requestedItems = new Map<string, number>();
    for (const item of originalItems) {
      requestedItems.set(
        item.listingId,
        (requestedItems.get(item.listingId) ?? 0) + Number(item.quantityKg),
      );
    }
    if (!requestedItems.size) throw new Error("This order has no items to add again.");

    await db.transaction(async (tx) => {
      const listingIds = [...requestedItems.keys()];
      const stocks = await tx
        .select({
          id: listings.id,
          inventoryId: inventory.id,
          quantityKg: inventory.quantityKg,
          reservedKg: inventory.reservedKg,
        })
        .from(listings)
        .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
        .where(and(inArray(listings.id, listingIds), eq(listings.status, "published")));
      const stockByListing = new Map(stocks.map((stock) => [stock.id, stock]));
      if (stockByListing.size !== listingIds.length) {
        throw new Error("One or more products from this order are no longer available.");
      }

      const proposedCartId = crypto.randomUUID();
      await tx
        .insert(carts)
        .values({ id: proposedCartId, buyerId: buyer.id })
        .onDuplicateKeyUpdate({ set: { buyerId: sql`${carts.buyerId}` } });
      const [cart] = await tx
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.buyerId, buyer.id));
      if (!cart) throw new Error("Your cart could not be prepared.");

      const existingItems = await tx
        .select({
          id: cartItems.id,
          listingId: cartItems.listingId,
          quantityKg: cartItems.quantityKg,
        })
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), inArray(cartItems.listingId, listingIds)));
      for (const [listingId, requestedKg] of requestedItems) {
        const stock = stockByListing.get(listingId)!;
        const availableKg = Number(stock.quantityKg) - Number(stock.reservedKg);
        if (requestedKg > availableKg) {
          throw new Error(
            `Only ${Math.max(0, availableKg)} kg is currently available for one of these products.`,
          );
        }
      }

      for (const [listingId, requestedKg] of requestedItems) {
        const existingItem = existingItems.find((item) => item.listingId === listingId);
        const existingKg = existingItem ? Number(existingItem.quantityKg) : undefined;
        const cartItemId = existingItem?.id ?? crypto.randomUUID();
        if (existingKg === undefined) {
          await tx.insert(cartItems).values({
            id: cartItemId,
            cartId: cart.id,
            listingId,
            quantityKg: requestedKg.toFixed(2),
          });
        } else {
          await tx
            .update(cartItems)
            .set({ quantityKg: (existingKg + requestedKg).toFixed(2) })
            .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, listingId)));
        }
        const stock = stockByListing.get(listingId)!;
        const [reservation] = await tx
          .update(inventory)
          .set({ reservedKg: sql`${inventory.reservedKg} + ${requestedKg}` })
          .where(
            and(
              eq(inventory.id, stock.inventoryId),
              sql`${inventory.quantityKg} - ${inventory.reservedKg} >= ${requestedKg}`,
            ),
          );
        if (reservation.affectedRows !== 1) {
          throw new Error("Stock changed before this order could be added back to your cart.");
        }
        await tx.insert(inventoryMovements).values({
          id: crypto.randomUUID(),
          inventoryId: stock.inventoryId,
          movementType: "reservation",
          reservedChangeKg: requestedKg.toFixed(2),
          referenceType: "cart",
          referenceId: cartItemId,
          recordedById: buyer.id,
          note: "Reserved after reordering a completed purchase.",
        });
      }
    });
    const quantityKg = [...requestedItems.values()].reduce((total, amount) => total + amount, 0);
    await writeAuditLog(buyer.id, "cart.rebuild_from_order", "order", order.id, {
      orderNumber: data.orderNumber,
      quantityKg,
    });
    return { quantityKg };
  });

export const getOrderDetails = createServerFn({ method: "GET" })
  .validator(orderNumberInput)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/services/auth/auth-server");
    const viewer = await requireUser();
    const { db } = await import("@/db/client.server");
    const {
      classifications,
      inventory,
      listings,
      orderItems,
      orderStatusHistory,
      orders,
      payments,
      products,
      users,
    } = await import("@/db/schema");
    const [order] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        buyerId: orders.buyerId,
        buyerName: users.displayName,
        status: orders.status,
        contact: orders.contact,
        pickupNote: orders.pickupNote,
        totalAmount: orders.totalAmount,
        createdAt: orders.createdAt,
        confirmedAt: orders.confirmedAt,
        soldAt: orders.soldAt,
        paymentNumber: payments.paymentNumber,
        paymentMethod: payments.method,
        paidAt: payments.paidAt,
      })
      .from(orders)
      .innerJoin(users, eq(orders.buyerId, users.id))
      .leftJoin(payments, eq(payments.orderId, orders.id))
      .where(eq(orders.orderNumber, data.orderNumber));
    if (!order) throw new Error("The requested order could not be found.");

    const staffRoles = ["Management", "Marketer", "Accounting"];
    if (!viewer.roles.some((role) => staffRoles.includes(role)) && order.buyerId !== viewer.id) {
      throw new Error("You do not have permission to view this order.");
    }

    const [items, history] = await Promise.all([
      db
        .select({
          listingId: orderItems.listingId,
          name: products.name,
          classification: classifications.name,
          quantityKg: orderItems.quantityKg,
          pricePerKg: orderItems.pricePerKg,
        })
        .from(orderItems)
        .innerJoin(listings, eq(orderItems.listingId, listings.id))
        .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
        .innerJoin(products, eq(inventory.productId, products.id))
        .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
        .where(eq(orderItems.orderId, order.id)),
      db
        .select({
          status: orderStatusHistory.status,
          note: orderStatusHistory.note,
          changedAt: orderStatusHistory.changedAt,
        })
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, order.id))
        .orderBy(asc(orderStatusHistory.changedAt)),
    ]);

    return {
      orderNumber: order.orderNumber,
      buyer: order.buyerId === viewer.id ? "You" : order.buyerName,
      status: order.status,
      contact: order.contact,
      pickupNote: order.pickupNote,
      totalAmount: Number(order.totalAmount),
      createdAt: order.createdAt.toISOString(),
      confirmedAt: order.confirmedAt?.toISOString() ?? null,
      soldAt: order.soldAt?.toISOString() ?? null,
      payment: order.paymentNumber
        ? {
            paymentNumber: order.paymentNumber,
            method: order.paymentMethod,
            paidAt: order.paidAt?.toISOString() ?? null,
          }
        : null,
      items: items.map((item) => ({
        ...item,
        quantityKg: Number(item.quantityKg),
        pricePerKg: Number(item.pricePerKg),
      })),
      history: history.map((entry) => ({
        status: entry.status,
        note: entry.note,
        changedAt: entry.changedAt.toISOString(),
      })),
    };
  });

export const getDatabaseOrders = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAnyRole } = await import("@/services/auth/auth-server");
  await requireAnyRole(["Management", "Marketer", "Accounting"]);
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, listings, orderItems, orders, payments, products, users } =
    await import("@/db/schema");
  const farmerUsers = alias(users, "farmer_users");
  const orderRows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalAmount: orders.totalAmount,
      contact: orders.contact,
      pickupNote: orders.pickupNote,
      createdAt: orders.createdAt,
      confirmedAt: orders.confirmedAt,
      soldAt: orders.soldAt,
      buyer: users.displayName,
      paymentId: payments.paymentNumber,
      paymentMethod: payments.method,
      paidAt: payments.paidAt,
    })
    .from(orders)
    .innerJoin(users, eq(orders.buyerId, users.id))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .orderBy(desc(orders.createdAt), desc(orders.id));
  if (!orderRows.length) return [] as DemoOrder[];
  const items = await db
    .select({
      orderId: orderItems.orderId,
      listingId: orderItems.listingId,
      name: products.name,
      classification: classifications.name,
      farmer: farmerUsers.displayName,
      quantityKg: orderItems.quantityKg,
      pricePerKg: orderItems.pricePerKg,
    })
    .from(orderItems)
    .innerJoin(listings, eq(orderItems.listingId, listings.id))
    .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
    .leftJoin(farmerUsers, eq(inventory.farmerId, farmerUsers.id))
    .where(
      inArray(
        orderItems.orderId,
        orderRows.map((order) => order.id),
      ),
    );
  return orderRows.map((order) => {
    const lines = items
      .filter((item) => item.orderId === order.id)
      .map((item) => ({
        ...item,
        quantityKg: Number(item.quantityKg),
        pricePerKg: Number(item.pricePerKg),
      }));
    const first = lines[0];
    return {
      id: order.orderNumber,
      buyer: order.buyer,
      farmer: first?.farmer ?? "Legacy / mixed stock",
      product: first?.name ?? "Product",
      classification: first?.classification ?? "Good",
      quantity: `${lines.reduce((sum, item) => sum + item.quantityKg, 0)} kg`,
      total: new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
        Number(order.totalAmount),
      ),
      amount: Number(order.totalAmount),
      status:
        `${order.status.charAt(0).toUpperCase()}${order.status.slice(1)}` as DemoOrder["status"],
      paymentStatus: order.paymentId ? "Paid" : "Unpaid",
      date: order.createdAt.toLocaleDateString("en-PH"),
      createdAt: order.createdAt.toISOString(),
      ...(order.confirmedAt ? { confirmedAt: order.confirmedAt.toLocaleDateString("en-PH") } : {}),
      ...(order.soldAt ? { soldAt: order.soldAt.toLocaleDateString("en-PH") } : {}),
      ...(order.paymentId ? { paymentId: order.paymentId } : {}),
      ...(order.paymentMethod ? { paymentMethod: order.paymentMethod } : {}),
      ...(order.paidAt ? { paidAt: order.paidAt.toLocaleDateString("en-PH") } : {}),
      contact: order.contact,
      pickupNote: order.pickupNote,
      items: lines,
      stockReserved: order.status === "pending" || order.status === "confirmed",
    } satisfies DemoOrder;
  });
});

export const getManagementProductWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Management");
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, listings, products, users } = await import("@/db/schema");
  const [catalog, stock] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        cropType: products.cropType,
        active: products.active,
      })
      .from(products)
      .orderBy(asc(products.name)),
    db
      .select({
        id: inventory.id,
        name: products.name,
        cropType: products.cropType,
        classification: classifications.name,
        quantityKg: inventory.quantityKg,
        reservedKg: inventory.reservedKg,
        listingId: listings.id,
        listingStatus: listings.status,
        pricePerKg: listings.pricePerKg,
        farmer: users.displayName,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
      .leftJoin(listings, eq(listings.inventoryId, inventory.id))
      .leftJoin(users, eq(inventory.farmerId, users.id)),
  ]);
  return {
    catalog,
    stock: stock.map((row) => ({
      ...row,
      quantityKg: Number(row.quantityKg),
      reservedKg: Number(row.reservedKg),
      availableKg: Math.max(0, Number(row.quantityKg) - Number(row.reservedKg)),
      pricePerKg: row.pricePerKg === null ? null : Number(row.pricePerKg),
    })),
  };
});

export const getManagementDecisionSupport = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Management");
  const { db } = await import("@/db/client.server");
  const { classifications, dailyPrices, inventory, listings, orderItems, orders, products } =
    await import("@/db/schema");
  const [stock, orderLines, priceHistory] = await Promise.all([
    db
      .select({
        id: inventory.id,
        name: products.name,
        classification: classifications.name,
        availableKg: sql<string>`${inventory.quantityKg} - ${inventory.reservedKg}`,
        listingStatus: listings.status,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
      .leftJoin(listings, eq(listings.inventoryId, inventory.id)),
    db
      .select({
        name: products.name,
        classification: classifications.name,
        quantityKg: orderItems.quantityKg,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(listings, eq(orderItems.listingId, listings.id))
      .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(classifications, eq(inventory.classificationId, classifications.id)),
    db
      .select({
        listingId: dailyPrices.listingId,
        name: products.name,
        classification: classifications.name,
        price: dailyPrices.price,
        priceDate: dailyPrices.priceDate,
      })
      .from(dailyPrices)
      .innerJoin(listings, eq(dailyPrices.listingId, listings.id))
      .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
      .where(eq(dailyPrices.published, true)),
  ]);
  return {
    stock: stock.map((row) => ({ ...row, availableKg: Math.max(0, Number(row.availableKg)) })),
    orderLines: orderLines.map((row) => ({
      ...row,
      quantityKg: Number(row.quantityKg),
      createdAt: row.createdAt.toISOString(),
    })),
    priceHistory: priceHistory.map((row) => ({
      ...row,
      price: Number(row.price),
      priceDate: row.priceDate.toISOString(),
    })),
  };
});

export const getManagementReport = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Management");
  const { db } = await import("@/db/client.server");
  const {
    classifications,
    inventory,
    listings,
    orders,
    payments,
    products,
    productionRecords,
    receivingRecords,
  } = await import("@/db/schema");
  const [stock, received, production, databaseOrders, databasePayments] = await Promise.all([
    db
      .select({
        name: products.name,
        classification: classifications.name,
        quantityKg: inventory.quantityKg,
        reservedKg: inventory.reservedKg,
        listingStatus: listings.status,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
      .leftJoin(listings, eq(listings.inventoryId, inventory.id)),
    db.select({ totalKg: receivingRecords.totalKg }).from(receivingRecords),
    db.select({ harvestedKg: productionRecords.harvestedQuantityKg }).from(productionRecords),
    db.select({ status: orders.status }).from(orders),
    db.select({ id: payments.id }).from(payments),
  ]);
  const availableKg = stock.reduce(
    (total, row) => total + Number(row.quantityKg) - Number(row.reservedKg),
    0,
  );
  const supplyKg = received.reduce((total, row) => total + Number(row.totalKg), 0);
  const marketplaceAvailableKg = stock.reduce(
    (total, row) =>
      total +
      (row.listingStatus === "published"
        ? Math.max(0, Number(row.quantityKg) - Number(row.reservedKg))
        : 0),
    0,
  );
  const harvestKg = production.reduce((total, row) => total + Number(row.harvestedKg ?? 0), 0);
  const demand = databaseOrders.filter(
    (order) => order.status === "pending" || order.status === "confirmed",
  ).length;
  const sold = databaseOrders.filter((order) => order.status === "sold").length;
  return {
    summaries: [
      {
        label: "Marketplace availability",
        value: `${marketplaceAvailableKg} kg`,
        detail: "Published stock currently available to buyers",
      },
      {
        label: "Classified stock",
        value: `${availableKg} kg`,
        detail: "All classified stock after buyer reservations",
      },
      {
        label: "Supply",
        value: `${supplyKg} kg`,
        detail: "Products received from farmer deliveries",
      },
      {
        label: "Demand",
        value: `${demand} order${demand === 1 ? "" : "s"}`,
        detail: "Pending or confirmed buyer orders",
      },
      {
        label: "Production",
        value: `${production.length} records`,
        detail: "Recorded production entries",
      },
      { label: "Harvest", value: `${harvestKg} kg`, detail: "Recorded harvested quantity" },
      {
        label: "Receiving",
        value: `${received.length} records`,
        detail: "Recorded farmer deliveries",
      },
      {
        label: "Sales",
        value: `${sold} sale${sold === 1 ? "" : "s"}`,
        detail: "Sold PROCY orders",
      },
      {
        label: "Payments",
        value: `${databasePayments.length} paid`,
        detail: "Accounting-recorded payments",
      },
      {
        label: "Transactions",
        value: `${databaseOrders.length} records`,
        detail: "Linked marketplace orders",
      },
    ],
    availability: stock.map((row) => ({
      label: `${row.name} — ${row.classification} Available Quantity (kg)`,
      value: Math.max(0, Number(row.quantityKg) - Number(row.reservedKg)),
    })),
  };
});

export const getMarketerDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Marketer");
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, listings, orders, products, receivingRecords } =
    await import("@/db/schema");
  const [receiving, stock, publishedListings, pendingOrders, lowStock] = await Promise.all([
    db.select({ totalKg: receivingRecords.totalKg }).from(receivingRecords),
    db
      .select({ quantityKg: inventory.quantityKg, reservedKg: inventory.reservedKg })
      .from(inventory),
    db.select({ id: listings.id }).from(listings).where(eq(listings.status, "published")),
    db.select({ id: orders.id }).from(orders).where(eq(orders.status, "pending")),
    db
      .select({
        id: inventory.id,
        name: products.name,
        classification: classifications.name,
        availableKg: sql<string>`${inventory.quantityKg} - ${inventory.reservedKg}`,
      })
      .from(listings)
      .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
      .where(
        and(
          eq(listings.status, "published"),
          sql`${inventory.quantityKg} - ${inventory.reservedKg} <= 5`,
        ),
      ),
  ]);
  const receivedKg = receiving.reduce((total, row) => total + Number(row.totalKg), 0);
  const availableKg = stock.reduce(
    (total, row) => total + Math.max(0, Number(row.quantityKg) - Number(row.reservedKg)),
    0,
  );
  return {
    receivedKg,
    publishedListings: publishedListings.length,
    availableKg,
    pendingOrders: pendingOrders.length,
    lowStock: lowStock
      .map((row) => ({ ...row, availableKg: Math.max(0, Number(row.availableKg)) }))
      .sort((first, second) => first.availableKg - second.availableKg),
  };
});

export const confirmDatabaseOrder = createServerFn({ method: "POST" })
  .validator(workflowActionInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { orderStatusHistory, orders } = await import("@/db/schema");
    const confirmedOrder = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, data.orderNumber));
      if (!order) throw new Error("The requested order could not be found.");
      const now = new Date();
      const [transition] = await tx
        .update(orders)
        .set({ status: "confirmed", confirmedAt: now })
        .where(and(eq(orders.id, order.id), eq(orders.status, "pending")));
      if (transition.affectedRows !== 1) {
        throw new Error("Only an unchanged Pending order can be confirmed.");
      }
      await tx.insert(orderStatusHistory).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        status: "confirmed",
        changedById: actor.id,
        note: "Marketer confirmed the reserved classified stock.",
        changedAt: now,
      });
      await writeAuditLog(actor.id, "order.confirm", "order", order.id, {
        orderNumber: order.orderNumber,
      });
      return { orderId: order.id, buyerId: order.buyerId, orderNumber: order.orderNumber };
    });
    const { notifyUser } = await import("@/services/messaging/notification-server");
    await notifyUser(confirmedOrder.buyerId, {
      title: "Order confirmed",
      message: `${confirmedOrder.orderNumber} has been confirmed by PROCY.`,
      target: "/buyer/orders",
    });
    return confirmedOrder;
  });

export const markDatabaseOrderSold = createServerFn({ method: "POST" })
  .validator(workflowActionInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { inventory, inventoryMovements, listings, orderItems, orderStatusHistory, orders } =
      await import("@/db/schema");
    const soldOrder = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, data.orderNumber));
      if (!order) throw new Error("The requested order could not be found.");
      const now = new Date();
      const [transition] = await tx
        .update(orders)
        .set({ status: "sold", soldAt: now })
        .where(and(eq(orders.id, order.id), eq(orders.status, "confirmed")));
      if (transition.affectedRows !== 1) {
        throw new Error("Only an unchanged Confirmed order can be marked Sold.");
      }
      const lines = await tx
        .select({
          listingId: orderItems.listingId,
          quantityKg: orderItems.quantityKg,
          inventoryId: inventory.id,
        })
        .from(orderItems)
        .innerJoin(listings, eq(orderItems.listingId, listings.id))
        .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
        .where(eq(orderItems.orderId, order.id));
      for (const line of lines) {
        const [sale] = await tx
          .update(inventory)
          .set({
            quantityKg: sql`${inventory.quantityKg} - ${line.quantityKg}`,
            reservedKg: sql`${inventory.reservedKg} - ${line.quantityKg}`,
          })
          .where(
            and(
              eq(inventory.id, line.inventoryId),
              sql`${inventory.quantityKg} >= ${line.quantityKg}`,
              sql`${inventory.reservedKg} >= ${line.quantityKg}`,
            ),
          );
        if (sale.affectedRows !== 1) {
          throw new Error(
            "Inventory changed before this sale could be completed. No stock was deducted.",
          );
        }
        await tx.insert(inventoryMovements).values({
          id: crypto.randomUUID(),
          inventoryId: line.inventoryId,
          movementType: "sale",
          availableChangeKg: `-${line.quantityKg}`,
          reservedChangeKg: `-${line.quantityKg}`,
          referenceType: "order",
          referenceId: order.id,
          recordedById: actor.id,
          note: `Sold for ${order.orderNumber}.`,
        });
      }
      await tx.insert(orderStatusHistory).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        status: "sold",
        changedById: actor.id,
        note: "Order fulfilled and marked sold.",
        changedAt: now,
      });
      await writeAuditLog(actor.id, "order.sell", "order", order.id, {
        orderNumber: order.orderNumber,
      });
      return { orderId: order.id, buyerId: order.buyerId, orderNumber: order.orderNumber };
    });
    const { notifyUser, notifyRole } = await import("@/services/messaging/notification-server");
    await notifyUser(soldOrder.buyerId, {
      title: "Order fulfilled",
      message: `${soldOrder.orderNumber} is ready for payment recording.`,
      target: "/buyer/orders",
    });
    await notifyRole("Accounting", {
      title: "Payment ready to record",
      message: `${soldOrder.orderNumber} was marked Sold and is ready for payment recording.`,
      target: "/accounting/payments",
    });
    return soldOrder;
  });

export const releaseDatabaseOrder = createServerFn({ method: "POST" })
  .validator(releaseOrderInput)
  .handler(async ({ data }) => {
    const { requireUser, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireUser();
    const { db } = await import("@/db/client.server");
    const { inventory, inventoryMovements, listings, orderItems, orderStatusHistory, orders } =
      await import("@/db/schema");

    const releasedOrder = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, data.orderNumber));
      if (!order) throw new Error("The requested order could not be found.");

      const isBuyer = actor.roles.includes("Buyer");
      const isMarketer = actor.roles.includes("Marketer");
      const buyerIsCancellingOwnOrder =
        isBuyer && order.buyerId === actor.id && data.outcome === "cancelled";

      if (!buyerIsCancellingOwnOrder && !isMarketer) {
        throw new Error("Only the Buyer or a Marketer can change this order.");
      }

      if (buyerIsCancellingOwnOrder && order.status !== "pending") {
        throw new Error(
          "Confirmed orders can only be cancelled by a Marketer. Please contact PROCY for assistance.",
        );
      }

      const [transition] = await tx
        .update(orders)
        .set({ status: data.outcome })
        .where(
          and(
            eq(orders.id, order.id),
            isMarketer
              ? sql`${orders.status} IN ('pending', 'confirmed')`
              : eq(orders.status, "pending"),
          ),
        );
      if (transition.affectedRows !== 1) {
        throw new Error(
          isMarketer
            ? "Only a Pending or Confirmed order can be cancelled or rejected."
            : "Only a Pending order can be cancelled.",
        );
      }

      const lines = await tx
        .select({ inventoryId: inventory.id, quantityKg: orderItems.quantityKg })
        .from(orderItems)
        .innerJoin(listings, eq(orderItems.listingId, listings.id))
        .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
        .where(eq(orderItems.orderId, order.id));
      for (const line of lines) {
        const [release] = await tx
          .update(inventory)
          .set({ reservedKg: sql`${inventory.reservedKg} - ${line.quantityKg}` })
          .where(
            and(
              eq(inventory.id, line.inventoryId),
              sql`${inventory.reservedKg} >= ${line.quantityKg}`,
            ),
          );
        if (release.affectedRows !== 1) {
          throw new Error("Reserved stock is inconsistent, so this order was not released.");
        }
        await tx.insert(inventoryMovements).values({
          id: crypto.randomUUID(),
          inventoryId: line.inventoryId,
          movementType: "release",
          reservedChangeKg: `-${line.quantityKg}`,
          referenceType: "order",
          referenceId: order.id,
          recordedById: actor.id,
          note: `${data.outcome === "cancelled" ? "Cancelled" : "Rejected"} ${order.orderNumber}.`,
        });
      }
      await tx.insert(orderStatusHistory).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        status: data.outcome,
        changedById: actor.id,
        note: data.reason ?? `Order ${data.outcome}. Reserved stock released.`,
        changedAt: new Date(),
      });
      await writeAuditLog(actor.id, `order.${data.outcome}`, "order", order.id, {
        orderNumber: order.orderNumber,
      });
      return {
        orderId: order.id,
        status: data.outcome,
        buyerId: order.buyerId,
        orderNumber: order.orderNumber,
      };
    });
    if (releasedOrder.buyerId !== actor.id) {
      const { notifyUser } = await import("@/services/messaging/notification-server");
      await notifyUser(releasedOrder.buyerId, {
        title: releasedOrder.status === "rejected" ? "Order rejected" : "Order cancelled",
        message: `${releasedOrder.orderNumber} was ${releasedOrder.status}; reserved stock was released.`,
        target: "/buyer/orders",
      });
    } else {
      const { notifyRole } = await import("@/services/messaging/notification-server");
      await notifyRole("Marketer", {
        title: "Buyer cancelled an order",
        message: `${releasedOrder.orderNumber} was cancelled while it was still Pending.`,
        target: "/marketer/orders",
      });
    }
    return releasedOrder;
  });

export const recordDatabasePayment = createServerFn({ method: "POST" })
  .validator(paymentInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Accounting");
    const { db } = await import("@/db/client.server");
    const { orders, payments } = await import("@/db/schema");
    const payment = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, data.orderNumber));
      if (!order) throw new Error("The requested order could not be found.");
      if (order.status !== "sold")
        throw new Error("Only Sold orders can receive a payment record.");
      const existing = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.orderId, order.id));
      if (existing.length) throw new Error("Payment has already been recorded for this order.");
      const paymentNumber = `PAY-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await tx.insert(payments).values({
        id: crypto.randomUUID(),
        paymentNumber,
        orderId: order.id,
        method: data.method,
        amount: order.totalAmount,
        recordedById: actor.id,
        paidAt: new Date(),
      });
      await writeAuditLog(actor.id, "payment.record", "payment", paymentNumber, {
        orderNumber: order.orderNumber,
      });
      return { paymentNumber, buyerId: order.buyerId, orderNumber: order.orderNumber };
    });
    const { notifyUser } = await import("@/services/messaging/notification-server");
    await notifyUser(payment.buyerId, {
      title: "Payment recorded",
      message: `Payment ${payment.paymentNumber} was recorded for ${payment.orderNumber}.`,
      target: "/buyer/orders",
    });
    return payment;
  });
