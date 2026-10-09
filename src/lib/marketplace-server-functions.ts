// Server functions are client-safe RPC stubs; their handlers stay on the server.
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Classification, Product } from "@/lib/products";
import type { DemoOrder } from "@/lib/demo-orders";

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
  method: z.enum(["cash", "bank_transfer", "manual_reference"]),
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
const bundlePricingFields = {
  retailPricePerKg: z.number().positive().max(100_000),
  bundlePricePerKg: z.number().positive().max(100_000),
  bundleMinimumKg: z.number().positive().max(10_000),
};

const createListingInput = z
  .object({
    inventoryId: z.string().uuid(),
    ...bundlePricingFields,
    status: z.enum(["draft", "published"]).default("published"),
  })
  .refine((data) => data.bundlePricePerKg < data.retailPricePerKg, {
    message: "Bundle price must be lower than the retail price.",
    path: ["bundlePricePerKg"],
  });
const updateListingPricingInput = z
  .object({ listingId: z.string().uuid(), ...bundlePricingFields })
  .refine((data) => data.bundlePricePerKg < data.retailPricePerKg, {
    message: "Bundle price must be lower than the retail price.",
    path: ["bundlePricePerKg"],
  });
const cropTypes = [
  "Leafy vegetable",
  "Root vegetable",
  "Fruiting vegetable",
  "Cruciferous vegetable",
  "Legume",
  "Herb",
  "Other",
] as const;

const createCatalogProductInput = z.object({
  name: z.string().trim().min(2).max(160),
  cropType: z.enum(cropTypes),
  description: z.string().trim().min(4).max(2000).optional(),
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

type MarketplaceProduct = Product;
type MarketerMarketplaceProduct = MarketplaceProduct & { farmer: string | null };

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
    })
    .from(listings)
    .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
    .leftJoin(users, eq(inventory.farmerId, users.id))
    .where(eq(listings.status, "published"));
  return rows.map((row) => ({ ...asProduct(row), farmer: row.farmer }));
}

export const getMarketplaceListings = createServerFn({ method: "GET" }).handler(async () =>
  fetchListings(),
);

export const getMarketerMarketplaceListings = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireRole } = await import("@/lib/auth-server");
    await requireRole("Marketer");
    return fetchMarketerListings();
  },
);

export const createCatalogProduct = createServerFn({ method: "POST" })
  .validator(createCatalogProductInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
    const actor = await requireRole("Marketer");
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

export const getCatalogProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/lib/auth-server");
  await requireRole("Marketer");
  const { db } = await import("@/db/client.server");
  const { products } = await import("@/db/schema");
  return db
    .select({
      id: products.id,
      name: products.name,
      cropType: products.cropType,
      description: products.description,
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.name));
});

export const getPublishableInventory = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/lib/auth-server");
  await requireRole("Marketer");
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, listings, products, users } = await import("@/db/schema");
  return db
    .select({
      id: inventory.id,
      name: products.name,
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
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
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
        bundlePricePerKg: data.bundlePricePerKg.toFixed(2),
        bundleMinimumKg: data.bundleMinimumKg.toFixed(2),
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
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { listings } = await import("@/db/schema");
    const [updated] = await db
      .update(listings)
      .set({
        pricePerKg: data.retailPricePerKg.toFixed(2),
        retailPricePerKg: data.retailPricePerKg.toFixed(2),
        bundlePricePerKg: data.bundlePricePerKg.toFixed(2),
        bundleMinimumKg: data.bundleMinimumKg.toFixed(2),
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
    .where(publicOnly ? eq(dailyPrices.published, true) : undefined)
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
  const { requireRole } = await import("@/lib/auth-server");
  await requireRole("Marketer");
  return fetchDailyPrices(false);
});

export const publishDailyPrice = createServerFn({ method: "POST" })
  .validator(dailyPriceInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { dailyPrices, listings } = await import("@/db/schema");
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.id, data.listingId));
    if (!listing) throw new Error("The selected marketplace listing no longer exists.");
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
    return { id, updated: false };
  });

export const setDailyPricePublished = createServerFn({ method: "POST" })
  .validator(dailyPriceStatusInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { dailyPrices } = await import("@/db/schema");
    const [result] = await db
      .update(dailyPrices)
      .set({ published: data.published })
      .where(eq(dailyPrices.id, data.id));
    if (result.affectedRows !== 1) throw new Error("The daily price could not be found.");
    await writeAuditLog(actor.id, "daily_price.visibility", "daily_price", data.id, data);
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

export const getBuyerCart = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/lib/auth-server");
  const buyer = await requireRole("Buyer");
  return buyerCartRows(buyer.id);
});

export const addBuyerCartItem = createServerFn({ method: "POST" })
  .validator(cartItemInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("@/lib/auth-server");
    const buyer = await requireRole("Buyer");
    const { db } = await import("@/db/client.server");
    const { cartItems, carts, inventory, listings } = await import("@/db/schema");
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
        .select({ quantityKg: cartItems.quantityKg })
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
      const nextQuantity = Number(existing?.quantityKg ?? 0) + data.quantityKg;
      if (nextQuantity > availableKg) {
        throw new Error(`Only ${availableKg} kg is currently available.`);
      }
      if (existing) {
        await tx
          .update(cartItems)
          .set({ quantityKg: nextQuantity.toFixed(2) })
          .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
      } else {
        await tx.insert(cartItems).values({
          id: crypto.randomUUID(),
          cartId: cart.id,
          listingId: data.listingId,
          quantityKg: data.quantityKg.toFixed(2),
        });
      }
    });
    return buyerCartRows(buyer.id);
  });

export const setBuyerCartItem = createServerFn({ method: "POST" })
  .validator(setCartItemInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("@/lib/auth-server");
    const buyer = await requireRole("Buyer");
    const { db } = await import("@/db/client.server");
    const { cartItems, carts, inventory, listings } = await import("@/db/schema");
    await db.transaction(async (tx) => {
      const [cart] = await tx
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.buyerId, buyer.id));
      if (!cart) return;
      if (data.quantityKg === 0) {
        await tx
          .delete(cartItems)
          .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
        return;
      }
      const [listing] = await tx
        .select({ quantityKg: inventory.quantityKg, reservedKg: inventory.reservedKg })
        .from(listings)
        .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
        .where(and(eq(listings.id, data.listingId), eq(listings.status, "published")));
      const availableKg = listing ? Number(listing.quantityKg) - Number(listing.reservedKg) : 0;
      if (data.quantityKg > availableKg) {
        throw new Error(`Only ${availableKg} kg is currently available.`);
      }
      const [updated] = await tx
        .update(cartItems)
        .set({ quantityKg: data.quantityKg.toFixed(2) })
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
      if (updated.affectedRows !== 1) throw new Error("That item is no longer in your cart.");
    });
    return buyerCartRows(buyer.id);
  });

export const placeBuyerOrder = createServerFn({ method: "POST" })
  .validator(checkoutInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
    const buyer = await requireRole("Buyer");
    const { db } = await import("@/db/client.server");
    const {
      inventory,
      inventoryMovements,
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
        const availableKg = Number(row.quantityKg) - Number(row.reservedKg);
        if (item.quantityKg > availableKg) {
          throw new Error(
            `${row.name} (${row.classification}) has only ${availableKg} kg available.`,
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
        const [reservation] = await tx
          .update(inventory)
          .set({ reservedKg: sql`${inventory.reservedKg} + ${item.quantityKg}` })
          .where(
            and(
              eq(inventory.id, row.inventoryId),
              sql`${inventory.quantityKg} - ${inventory.reservedKg} >= ${item.quantityKg}`,
            ),
          );
        if (reservation.affectedRows !== 1) {
          throw new Error(
            `${row.name} (${row.classification}) no longer has enough quantity available. Please refresh your cart.`,
          );
        }
        await tx.insert(inventoryMovements).values({
          id: crypto.randomUUID(),
          inventoryId: row.inventoryId,
          movementType: "reservation",
          reservedChangeKg: item.quantityKg.toFixed(2),
          referenceType: "order",
          referenceId: orderId,
          recordedById: buyer.id,
          note: `Reserved for ${orderNumber}.`,
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

      const [cart] = await tx
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.buyerId, buyer.id));
      if (cart) {
        await tx
          .delete(cartItems)
          .where(and(eq(cartItems.cartId, cart.id), inArray(cartItems.listingId, listingIds)));
      }

      await writeAuditLog(buyer.id, "order.create", "order", orderId, { orderNumber });
      return { id: orderId, orderNumber, totalAmount, buyerName: buyer.displayName };
    });
    const { notifyRole } = await import("@/lib/notification-server");
    await notifyRole("Marketer", {
      title: "New buyer order",
      message: `${buyer.displayName} submitted ${createdOrder.orderNumber} for review.`,
      target: "/marketer/orders",
    });
    return createdOrder;
  });

export const getBuyerOrders = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/lib/auth-server");
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
    .where(eq(orders.buyerId, buyer.id));
  return rows.map((row) => ({
    ...row,
    totalAmount: Number(row.totalAmount),
    paymentStatus: row.paymentId ? "Paid" : "Unpaid",
  }));
});

export const rebuildBuyerCartFromOrder = createServerFn({ method: "POST" })
  .validator(orderNumberInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
    const buyer = await requireRole("Buyer");
    const { db } = await import("@/db/client.server");
    const { cartItems, carts, inventory, listings, orderItems, orders } =
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
        .select({ listingId: cartItems.listingId, quantityKg: cartItems.quantityKg })
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), inArray(cartItems.listingId, listingIds)));
      const existingByListing = new Map(
        existingItems.map((item) => [item.listingId, Number(item.quantityKg)]),
      );

      for (const [listingId, requestedKg] of requestedItems) {
        const stock = stockByListing.get(listingId)!;
        const availableKg = Number(stock.quantityKg) - Number(stock.reservedKg);
        if ((existingByListing.get(listingId) ?? 0) + requestedKg > availableKg) {
          throw new Error(
            `Only ${Math.max(0, availableKg)} kg is currently available for one of these products.`,
          );
        }
      }

      for (const [listingId, requestedKg] of requestedItems) {
        const existingKg = existingByListing.get(listingId);
        if (existingKg === undefined) {
          await tx.insert(cartItems).values({
            id: crypto.randomUUID(),
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
    const { requireUser } = await import("@/lib/auth-server");
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
  const { requireAnyRole } = await import("@/lib/auth-server");
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
    .leftJoin(payments, eq(payments.orderId, orders.id));
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
  const { requireRole } = await import("@/lib/auth-server");
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
  const { requireRole } = await import("@/lib/auth-server");
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
  const { requireRole } = await import("@/lib/auth-server");
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
  const { requireRole } = await import("@/lib/auth-server");
  await requireRole("Marketer");
  const { db } = await import("@/db/client.server");
  const { inventory, listings, orders, receivingRecords } = await import("@/db/schema");
  const [receiving, stock, publishedListings, pendingOrders] = await Promise.all([
    db.select({ totalKg: receivingRecords.totalKg }).from(receivingRecords),
    db
      .select({ quantityKg: inventory.quantityKg, reservedKg: inventory.reservedKg })
      .from(inventory),
    db.select({ id: listings.id }).from(listings).where(eq(listings.status, "published")),
    db.select({ id: orders.id }).from(orders).where(eq(orders.status, "pending")),
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
  };
});

export const confirmDatabaseOrder = createServerFn({ method: "POST" })
  .validator(workflowActionInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
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
    const { notifyUser } = await import("@/lib/notification-server");
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
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
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
    const { notifyUser, notifyRole } = await import("@/lib/notification-server");
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
    const { requireUser, writeAuditLog } = await import("@/lib/auth-server");
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
      const isStaff = actor.roles.some((role) => ["Management", "Marketer"].includes(role));
      if (!isStaff && (!isBuyer || order.buyerId !== actor.id || data.outcome !== "cancelled")) {
        throw new Error("You do not have permission to release this order.");
      }

      const [transition] = await tx
        .update(orders)
        .set({ status: data.outcome })
        .where(and(eq(orders.id, order.id), sql`${orders.status} IN ('pending', 'confirmed')`));
      if (transition.affectedRows !== 1) {
        throw new Error("Only a Pending or Confirmed order can be cancelled or rejected.");
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
      const { notifyUser } = await import("@/lib/notification-server");
      await notifyUser(releasedOrder.buyerId, {
        title: releasedOrder.status === "rejected" ? "Order rejected" : "Order cancelled",
        message: `${releasedOrder.orderNumber} was ${releasedOrder.status}; reserved stock was released.`,
        target: "/buyer/orders",
      });
    }
    return releasedOrder;
  });

export const recordDatabasePayment = createServerFn({ method: "POST" })
  .validator(paymentInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/lib/auth-server");
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
    const { notifyUser } = await import("@/lib/notification-server");
    await notifyUser(payment.buyerId, {
      title: "Payment recorded",
      message: `Payment ${payment.paymentNumber} was recorded for ${payment.orderNumber}.`,
      target: "/buyer/orders",
    });
    return payment;
  });
