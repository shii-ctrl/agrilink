// Server functions are client-safe RPC stubs; their handlers stay on the server.
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Classification, Product, ProductOffer } from "@/features/marketplace/products";
import { procyMarketCategories } from "@/features/marketplace/procy-market-categories";
import {
  requiresWholeSellingQuantity,
  sellingUnitLabel,
  sellingUnits,
  type SellingUnit,
} from "@/features/marketplace/selling-units";
import type { DemoOrder } from "@/lib/demo/demo-orders";

type MarketplaceDatabase = (typeof import("@/db/client.server"))["db"];
type MarketplaceTransaction = Parameters<Parameters<MarketplaceDatabase["transaction"]>[0]>[0];
const marketplaceQualityOrder: Classification[] = ["Good", "Semi", "Reject"];

function marketplaceQualityRank(classification: string) {
  const rank = marketplaceQualityOrder.indexOf(classification as Classification);
  return rank < 0 ? marketplaceQualityOrder.length : rank;
}

const listingInput = z.object({ listingId: z.string().uuid() });
const orderNumberInput = z.object({ orderNumber: z.string().trim().min(3).max(40) });
const checkoutInput = z.object({
  contact: z.string().trim().min(5).max(80),
  pickupNote: z.string().trim().min(3).max(2000),
  fulfillment: z.enum(["pickup", "delivery"]),
  recipientName: z.string().trim().max(160).optional(),
  deliveryAddress: z.string().trim().max(2000).optional(),
  preferredSchedule: z.string().trim().max(255).optional(),
  deliveryInstructions: z.string().trim().max(2000).optional(),
  items: z
    .array(z.object({ listingId: z.string().uuid(), quantityKg: z.number().positive().max(10000) }))
    .min(1)
    .max(20),
});
const deliveryFeeInput = z.object({
  deliveryFee: z.number().finite().min(0).max(10_000),
});
const deliveryAvailabilityInput = z.object({
  deliveryEnabled: z.boolean(),
});
const cartItemInput = z.object({
  listingId: z.string().uuid(),
  quantityKg: z.number().positive().max(10_000),
});
const setCartItemInput = z.object({
  listingId: z.string().uuid(),
  quantityKg: z.number().min(0).max(10_000),
});
const CART_RESERVATION_MINUTES = 10;
const CART_RESERVATION_MS = CART_RESERVATION_MINUTES * 60 * 1000;

function nextCartReservationExpiry(now = new Date()) {
  return new Date(now.getTime() + CART_RESERVATION_MS);
}
const workflowActionInput = z.object({
  orderNumber: z.string().trim().min(3).max(40),
});
const fulfillmentStatusInput = workflowActionInput.extend({
  status: z.enum([
    "preparing",
    "ready_for_pickup",
    "ready_for_dispatch",
    "out_for_delivery",
    "picked_up",
  ]),
});
const assignRiderInput = workflowActionInput.extend({
  riderId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500).optional(),
});
const deliveryProofInput = workflowActionInput.extend({
  otp: z.string().regex(/^\d{6}$/),
  recipientName: z.string().trim().min(2).max(160),
});
const deliveryIssueInput = workflowActionInput.extend({
  outcome: z.enum(["buyer_unavailable", "wrong_address", "refused", "rescheduled"]),
  reasonNote: z.string().trim().min(3).max(1_000),
  nextSchedule: z.string().trim().max(255).optional(),
});
const codRemittanceInput = workflowActionInput.extend({
  action: z.enum(["submit", "verify", "close"]),
  notes: z.string().trim().max(1_000).optional(),
});
const paymentInput = workflowActionInput.extend({
  method: z.enum(["cash", "cash_on_delivery"]),
});

function createDeliveryOtp() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return String(value % 1_000_000).padStart(6, "0");
}
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
const dailyPriceAlertInput = z.object({
  listingId: z.string().uuid(),
  targetPrice: z.number().positive().max(100_000),
});
const managementDashboardInput = z.object({
  range: z.enum(["day", "month", "all"]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid dashboard date.")
    .optional(),
  year: z.number().int().min(2000).max(9999).optional(),
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
const marketplaceOfferSettingsInput = z
  .object({
    listingId: z.string().uuid(),
    retailPricePerKg: z.number().positive().max(100_000).nullable(),
    bundlePricePerKg: listingPricingFields.bundlePricePerKg,
    bundleMinimumKg: listingPricingFields.bundleMinimumKg,
    visible: z.boolean(),
  })
  .superRefine(validateBundlePricing);
const saveMarketplaceProductOffersInput = z.object({
  productId: z.string().uuid(),
  offers: z.array(marketplaceOfferSettingsInput).min(1).max(3),
});
const listingStatusInput = z.object({
  listingId: z.string().uuid(),
  status: z.enum(["draft", "published", "archived"]),
});
function validateBundlePricing(
  data: {
    retailPricePerKg: number | null;
    bundlePricePerKg: number | null;
    bundleMinimumKg: number | null;
  },
  context: z.RefinementCtx,
) {
  const hasBundlePrice = data.bundlePricePerKg !== null;
  const hasBundleMinimum = data.bundleMinimumKg !== null;
  if (data.retailPricePerKg === null && (hasBundlePrice || hasBundleMinimum)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a retail price before adding bundle pricing.",
      path: ["retailPricePerKg"],
    });
    return;
  }
  if (hasBundlePrice !== hasBundleMinimum) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter both bundle price and minimum quantity, or leave both blank.",
      path: hasBundlePrice ? ["bundleMinimumKg"] : ["bundlePricePerKg"],
    });
  }
  if (
    hasBundlePrice &&
    data.retailPricePerKg !== null &&
    data.bundlePricePerKg! >= data.retailPricePerKg
  ) {
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
  sellingUnit: z.enum(sellingUnits),
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

const updateMarketplaceOfferImageInput = z.object({
  listingId: z.string().uuid(),
  imageDataUrl: updateCatalogProductImageInput.shape.imageDataUrl,
});

const updateCatalogProductInput = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  cropType: z.enum(cropTypes),
  sellingUnit: z.enum(sellingUnits),
  description: z.string().trim().max(2000),
  imageDataUrl: createCatalogProductInput.shape.imageDataUrl,
});

const catalogProductStatusInput = z.object({
  productId: z.string().uuid(),
  active: z.boolean(),
});

const deleteCatalogProductInput = z.object({
  productId: z.string().uuid(),
});

const stockAdjustmentInput = z.object({
  inventoryId: z.string().uuid(),
  adjustmentKg: z
    .number()
    .finite()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((value) => value !== 0, "Enter a non-zero adjustment.")
    .refine((value) => Number.isInteger(value * 100), "Use at most two decimal places."),
  reason: z.string().trim().min(3).max(500),
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
  productId: string;
  name: string;
  cropType: string;
  sellingUnit: string;
  classification: string;
  pricePerKg: string;
  retailPricePerKg: string | null;
  bundlePricePerKg: string | null;
  bundleMinimumKg: string | null;
  availableKg: string;
  description: string | null;
  productImageUrl: string | null;
  offerImageUrl: string | null;
  priceConfigured: boolean;
}): MarketplaceProduct {
  const retailPricePerKg = Number(row.retailPricePerKg ?? row.pricePerKg);
  const bundlePricePerKg =
    row.bundlePricePerKg === null || row.bundleMinimumKg === null
      ? null
      : Number(row.bundlePricePerKg);
  const bundleMinimumKg = bundlePricePerKg === null ? null : Number(row.bundleMinimumKg);
  const availableQuantity = row.priceConfigured ? Math.max(0, Number(row.availableKg)) : 0;
  return {
    id: row.productId,
    name: row.name,
    cropType: row.cropType,
    sellingUnit: row.sellingUnit as SellingUnit,
    classification: row.classification as Classification,
    pricePerKg: retailPricePerKg,
    retailPricePerKg,
    bundlePricePerKg,
    bundleMinimumKg,
    quantityKg: availableQuantity,
    description:
      row.description ??
      `${row.name} supplied by PROCY farmer members with selectable quality options.`,
    image: row.productImageUrl ?? "",
    offers: [
      {
        id: row.listingId,
        classification: row.classification as ProductOffer["classification"],
        image: row.offerImageUrl ?? row.productImageUrl ?? "",
        pricePerKg: retailPricePerKg,
        retailPricePerKg,
        bundlePricePerKg,
        bundleMinimumKg,
        quantityKg: availableQuantity,
        priceConfigured: row.priceConfigured,
      },
    ],
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

async function fetchListings(productId?: string) {
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, listings, products } = await import("@/db/schema");
  const where = productId ? eq(listings.productId, productId) : undefined;
  const rows = await db
    .select({
      listingId: listings.id,
      productId: listings.productId,
      classificationId: listings.classificationId,
      name: products.name,
      cropType: products.cropType,
      sellingUnit: products.sellingUnit,
      classification: classifications.name,
      pricePerKg: listings.pricePerKg,
      retailPricePerKg: listings.retailPricePerKg,
      bundlePricePerKg: listings.bundlePricePerKg,
      bundleMinimumKg: listings.bundleMinimumKg,
      status: listings.status,
      // A marketplace listing represents a product + quality. Every delivery for the
      // same product/quality contributes to the buyer-facing quantity.
      availableKg: sql<string>`(
        SELECT COALESCE(SUM(stock.quantity_kg - stock.reserved_kg), 0)
        FROM inventory AS stock
        WHERE stock.product_id = ${listings.productId}
          AND stock.classification_id = ${listings.classificationId}
      )`,
      description: products.description,
      productImageUrl: products.imageUrl,
      offerImageUrl: listings.imageUrl,
      priceConfigured: listings.priceConfigured,
      active: products.active,
    })
    .from(listings)
    .innerJoin(products, eq(listings.productId, products.id))
    .innerJoin(classifications, eq(listings.classificationId, classifications.id))
    .where(where)
    .orderBy(desc(listings.updatedAt), desc(listings.id));
  const visibleRows = rows.filter((row) => row.status === "published");
  const grouped = new Map<string, MarketplaceProduct>();
  for (const row of visibleRows) {
    const offerProduct = asProduct(row);
    const current = grouped.get(row.productId);
    if (!current) {
      grouped.set(row.productId, offerProduct);
      continue;
    }
    current.offers = [...(current.offers ?? []), ...(offerProduct.offers ?? [])].sort(
      (a, b) => marketplaceQualityRank(a.classification) - marketplaceQualityRank(b.classification),
    );
    current.quantityKg = (current.offers ?? []).reduce(
      (total, offer) => total + offer.quantityKg,
      0,
    );
  }
  return [...grouped.values()];
}

async function fetchMarketerListings(): Promise<MarketerMarketplaceProduct[]> {
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, listings, products } = await import("@/db/schema");
  const rows = await db
    .select({
      listingId: listings.id,
      productId: listings.productId,
      classificationId: listings.classificationId,
      name: products.name,
      cropType: products.cropType,
      sellingUnit: products.sellingUnit,
      classification: classifications.name,
      pricePerKg: listings.pricePerKg,
      retailPricePerKg: listings.retailPricePerKg,
      bundlePricePerKg: listings.bundlePricePerKg,
      bundleMinimumKg: listings.bundleMinimumKg,
      availableKg: sql<string>`(
        SELECT COALESCE(SUM(stock.quantity_kg - stock.reserved_kg), 0)
        FROM inventory AS stock
        WHERE stock.product_id = ${listings.productId}
          AND stock.classification_id = ${listings.classificationId}
      )`,
      description: products.description,
      productImageUrl: products.imageUrl,
      offerImageUrl: listings.imageUrl,
      priceConfigured: listings.priceConfigured,
      status: listings.status,
    })
    .from(listings)
    .innerJoin(products, eq(listings.productId, products.id))
    .innerJoin(classifications, eq(listings.classificationId, classifications.id))
    .orderBy(desc(listings.updatedAt), desc(listings.id));
  return rows.map((row) => ({
    ...asProduct(row),
    id: row.listingId,
    farmer: null,
    status: row.status,
  }));
}

export const getMarketplaceListings = createServerFn({ method: "GET" }).handler(async () => {
  await expireAllBuyerCartReservations();
  return fetchListings();
});

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
    const { classifications, listings, products } = await import("@/db/schema");
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(sql`LOWER(${products.name}) = LOWER(${data.name})`);
    if (existing) {
      throw new Error("A catalog product with that name already exists.");
    }
    const id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(products).values({
        id,
        name: data.name,
        cropType: data.cropType,
        sellingUnit: data.sellingUnit,
        ...(data.description ? { description: data.description } : {}),
        ...(data.imageDataUrl ? { imageUrl: data.imageDataUrl } : {}),
      });
      const qualityRows = await tx
        .select({ id: classifications.id })
        .from(classifications)
        .where(inArray(classifications.name, ["Good", "Semi", "Reject"]));
      if (qualityRows.length !== 3)
        throw new Error("Good, Semi, and Reject classifications are required.");
      await tx.insert(listings).values(
        qualityRows.map((classification) => ({
          id: crypto.randomUUID(),
          productId: id,
          classificationId: classification.id,
          pricePerKg: "0.01",
          retailPricePerKg: "0.01",
          imageUrl: data.imageDataUrl || null,
          status: "draft" as const,
        })),
      );
    });
    await writeAuditLog(actor.id, "product.catalog_create", "product", id, { name: data.name });
    return { id };
  });

export const updateCatalogProduct = createServerFn({ method: "POST" })
  .validator(updateCatalogProductInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    assertSafeProductImage(data.imageDataUrl);
    const { db } = await import("@/db/client.server");
    const { inventory, products, receivingRecords } = await import("@/db/schema");
    const [duplicate] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          sql`LOWER(${products.name}) = LOWER(${data.name})`,
          sql`${products.id} <> ${data.productId}`,
        ),
      );
    if (duplicate) throw new Error("A catalog product with that name already exists.");
    const [savedProduct] = await db
      .select({ sellingUnit: products.sellingUnit })
      .from(products)
      .where(eq(products.id, data.productId));
    if (!savedProduct) throw new Error("The catalog product could not be found.");
    if (savedProduct.sellingUnit !== data.sellingUnit) {
      const [[stock], [receiving]] = await Promise.all([
        db
          .select({ id: inventory.id })
          .from(inventory)
          .where(eq(inventory.productId, data.productId))
          .limit(1),
        db
          .select({ id: receivingRecords.id })
          .from(receivingRecords)
          .where(eq(receivingRecords.productId, data.productId))
          .limit(1),
      ]);
      if (stock || receiving) {
        throw new Error("Selling unit cannot be changed after stock has been recorded.");
      }
    }
    const [updated] = await db
      .update(products)
      .set({
        name: data.name,
        cropType: data.cropType,
        sellingUnit: data.sellingUnit,
        description: data.description || null,
        ...(data.imageDataUrl ? { imageUrl: data.imageDataUrl } : {}),
      })
      .where(eq(products.id, data.productId));
    if (updated.affectedRows !== 1) throw new Error("The catalog product could not be found.");
    await writeAuditLog(actor.id, "product.catalog_update", "product", data.productId, {
      name: data.name,
      cropType: data.cropType,
      sellingUnit: data.sellingUnit,
    });
    return { id: data.productId };
  });

export const setCatalogProductActive = createServerFn({ method: "POST" })
  .validator(catalogProductStatusInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { listings, products } = await import("@/db/schema");
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(products)
        .set({ active: data.active })
        .where(eq(products.id, data.productId));
      if (updated.affectedRows !== 1) throw new Error("The catalog product could not be found.");
      if (!data.active) {
        await tx
          .update(listings)
          .set({ status: "archived" })
          .where(eq(listings.productId, data.productId));
      }
    });
    await writeAuditLog(
      actor.id,
      data.active ? "product.restore" : "product.archive",
      "product",
      data.productId,
    );
    return { id: data.productId, active: data.active };
  });

export const deleteCatalogProduct = createServerFn({ method: "POST" })
  .validator(deleteCatalogProductInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { cartItems, dailyPrices, inventory, listings, orderItems, products, receivingRecords } =
      await import("@/db/schema");

    const deletedProduct = await db.transaction(async (tx) => {
      const [product] = await tx
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(eq(products.id, data.productId))
        .limit(1);
      if (!product) throw new Error("The catalog product could not be found.");

      const offerRows = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.productId, product.id));
      const listingIds = offerRows.map((offer) => offer.id);
      const [inventoryRecord] = await tx
        .select({ id: inventory.id })
        .from(inventory)
        .where(eq(inventory.productId, product.id))
        .limit(1);
      const [receivingRecord] = await tx
        .select({ id: receivingRecords.id })
        .from(receivingRecords)
        .where(eq(receivingRecords.productId, product.id))
        .limit(1);

      let linkedMarketplaceRecord:
        { kind: "cart" | "order" | "daily price"; id: string } | undefined;
      if (listingIds.length > 0) {
        const [cartRecord] = await tx
          .select({ id: cartItems.id })
          .from(cartItems)
          .where(inArray(cartItems.listingId, listingIds))
          .limit(1);
        const [orderRecord] = await tx
          .select({ id: orderItems.id })
          .from(orderItems)
          .where(inArray(orderItems.listingId, listingIds))
          .limit(1);
        const [priceRecord] = await tx
          .select({ id: dailyPrices.id })
          .from(dailyPrices)
          .where(inArray(dailyPrices.listingId, listingIds))
          .limit(1);
        linkedMarketplaceRecord = cartRecord
          ? { kind: "cart", id: cartRecord.id }
          : orderRecord
            ? { kind: "order", id: orderRecord.id }
            : priceRecord
              ? { kind: "daily price", id: priceRecord.id }
              : undefined;
      }

      if (inventoryRecord || receivingRecord || linkedMarketplaceRecord) {
        throw new Error(
          "This crop already has stock or transaction history. Archive it instead so existing records remain accurate.",
        );
      }

      await tx.delete(listings).where(eq(listings.productId, product.id));
      const [deleted] = await tx.delete(products).where(eq(products.id, product.id));
      if (deleted.affectedRows !== 1) throw new Error("The catalog product could not be deleted.");
      return product;
    });

    await writeAuditLog(actor.id, "product.catalog_delete", "product", deletedProduct.id, {
      name: deletedProduct.name,
    });
    return { id: deletedProduct.id };
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

export const updateMarketplaceOfferImage = createServerFn({ method: "POST" })
  .validator(updateMarketplaceOfferImageInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    assertSafeProductImage(data.imageDataUrl);
    const { db } = await import("@/db/client.server");
    const { classifications, listings, products } = await import("@/db/schema");
    const [offer] = await db
      .select({
        id: listings.id,
        product: products.name,
        classification: classifications.name,
        productActive: products.active,
      })
      .from(listings)
      .innerJoin(products, eq(listings.productId, products.id))
      .innerJoin(classifications, eq(listings.classificationId, classifications.id))
      .where(eq(listings.id, data.listingId));
    if (!offer) throw new Error("This marketplace quality could not be found.");
    if (!offer.productActive) throw new Error("Restore this product before changing its photo.");

    await db.update(listings).set({ imageUrl: data.imageDataUrl }).where(eq(listings.id, offer.id));
    await writeAuditLog(actor.id, "listing.image.update", "marketplace_listing", offer.id, {
      product: offer.product,
      classification: offer.classification,
    });
    return { id: offer.id, imageUrl: data.imageDataUrl };
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
      sellingUnit: products.sellingUnit,
    })
    .from(products)
    .orderBy(desc(products.active), asc(products.name));
});

export const getMarketerProductCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Marketer");
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, inventoryMovements, listings, products, users } =
    await import("@/db/schema");
  const [productRows, offerRows, contributionRows, movementRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        cropType: products.cropType,
        description: products.description,
        imageUrl: products.imageUrl,
        active: products.active,
        sellingUnit: products.sellingUnit,
      })
      .from(products)
      .orderBy(desc(products.active), asc(products.name)),
    db
      .select({
        id: listings.id,
        productId: listings.productId,
        classification: classifications.name,
        retailPricePerKg: listings.retailPricePerKg,
        priceConfigured: listings.priceConfigured,
        bundlePricePerKg: listings.bundlePricePerKg,
        bundleMinimumKg: listings.bundleMinimumKg,
        imageUrl: listings.imageUrl,
        status: listings.status,
        availableKg: sql<string>`(
          SELECT COALESCE(SUM(stock.quantity_kg - stock.reserved_kg), 0)
          FROM inventory AS stock
          WHERE stock.product_id = ${listings.productId}
            AND stock.classification_id = ${listings.classificationId}
        )`,
      })
      .from(listings)
      .innerJoin(classifications, eq(listings.classificationId, classifications.id))
      .where(inArray(classifications.name, ["Good", "Semi", "Reject"])),
    db
      .select({
        id: inventory.id,
        productId: inventory.productId,
        farmerId: inventory.farmerId,
        farmer: users.displayName,
        classification: classifications.name,
        quantityKg: inventory.quantityKg,
        reservedKg: inventory.reservedKg,
      })
      .from(inventory)
      .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
      .leftJoin(users, eq(inventory.farmerId, users.id)),
    db
      .select({
        id: inventoryMovements.id,
        productId: inventory.productId,
        farmer: users.displayName,
        classification: classifications.name,
        movementType: inventoryMovements.movementType,
        availableChangeKg: inventoryMovements.availableChangeKg,
        reservedChangeKg: inventoryMovements.reservedChangeKg,
        note: inventoryMovements.note,
        createdAt: inventoryMovements.createdAt,
      })
      .from(inventoryMovements)
      .innerJoin(inventory, eq(inventoryMovements.inventoryId, inventory.id))
      .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
      .leftJoin(users, eq(inventory.farmerId, users.id))
      .orderBy(desc(inventoryMovements.createdAt)),
  ]);

  return productRows.map((product) => ({
    ...product,
    offers: offerRows
      .filter((offer) => offer.productId === product.id)
      .map((offer) => ({
        ...offer,
        imageUrl: offer.imageUrl ?? product.imageUrl,
        retailPricePerKg: Number(offer.retailPricePerKg ?? 0),
        bundlePricePerKg: offer.bundlePricePerKg === null ? null : Number(offer.bundlePricePerKg),
        bundleMinimumKg: offer.bundleMinimumKg === null ? null : Number(offer.bundleMinimumKg),
        availableKg: Math.max(0, Number(offer.availableKg)),
      }))
      .sort(
        (a, b) =>
          marketplaceQualityRank(a.classification) - marketplaceQualityRank(b.classification),
      ),
    contributions: contributionRows
      .filter((stock) => stock.productId === product.id)
      .map((stock) => ({
        ...stock,
        quantityKg: Number(stock.quantityKg),
        reservedKg: Number(stock.reservedKg),
        availableKg: Math.max(0, Number(stock.quantityKg) - Number(stock.reservedKg)),
      })),
    history: movementRows
      .filter((movement) => movement.productId === product.id)
      .slice(0, 50)
      .map((movement) => ({
        ...movement,
        availableChangeKg: Number(movement.availableChangeKg),
        reservedChangeKg: Number(movement.reservedChangeKg),
        createdAt: movement.createdAt.toISOString(),
      })),
  }));
});

export const adjustCatalogStock = createServerFn({ method: "POST" })
  .validator(stockAdjustmentInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { auditLogs, classifications, inventory, inventoryMovements, products, users } =
      await import("@/db/schema");
    const result = await db.transaction(async (tx) => {
      const [stock] = await tx
        .select({
          id: inventory.id,
          productId: inventory.productId,
          farmerId: inventory.farmerId,
          farmer: users.displayName,
          product: products.name,
          sellingUnit: products.sellingUnit,
          classification: classifications.name,
          quantityKg: inventory.quantityKg,
          reservedKg: inventory.reservedKg,
        })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
        .leftJoin(users, eq(inventory.farmerId, users.id))
        .where(eq(inventory.id, data.inventoryId));
      if (!stock) throw new Error("The selected farmer stock could not be found.");
      if (requiresWholeSellingQuantity(stock.sellingUnit) && !Number.isInteger(data.adjustmentKg)) {
        throw new Error(
          `${sellingUnitLabel(stock.sellingUnit, 2)} stock adjustments must use whole numbers.`,
        );
      }

      const nextQuantity = Number(stock.quantityKg) + data.adjustmentKg;
      if (nextQuantity < Number(stock.reservedKg)) {
        throw new Error("The corrected stock cannot be lower than its reserved quantity.");
      }
      if (nextQuantity < 0) throw new Error("The corrected stock cannot be negative.");

      const [updated] = await tx
        .update(inventory)
        .set({ quantityKg: nextQuantity.toFixed(2) })
        .where(
          and(
            eq(inventory.id, data.inventoryId),
            eq(inventory.quantityKg, stock.quantityKg),
            eq(inventory.reservedKg, stock.reservedKg),
          ),
        );
      if (updated.affectedRows !== 1) {
        throw new Error("Stock changed while the correction was being saved. Please try again.");
      }

      const movementId = crypto.randomUUID();
      await tx.insert(inventoryMovements).values({
        id: movementId,
        inventoryId: stock.id,
        movementType: "adjustment",
        availableChangeKg: data.adjustmentKg.toFixed(2),
        reservedChangeKg: "0",
        referenceType: "stock_adjustment",
        referenceId: movementId,
        recordedById: actor.id,
        note: data.reason,
      });
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actorId: actor.id,
        action: "inventory.adjust",
        entityType: "inventory",
        entityId: stock.id,
        details: {
          productId: stock.productId,
          farmerId: stock.farmerId,
          classification: stock.classification,
          adjustmentKg: data.adjustmentKg,
          previousQuantityKg: Number(stock.quantityKg),
          nextQuantityKg: nextQuantity,
          reason: data.reason,
        },
      });
      return {
        id: stock.id,
        product: stock.product,
        farmer: stock.farmer,
        classification: stock.classification,
        quantityKg: nextQuantity,
      };
    });
    return result;
  });

export const getPublishableInventory = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Marketer");
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, products } = await import("@/db/schema");
  const rows = await db
    .select({
      id: inventory.id,
      productId: inventory.productId,
      classificationId: inventory.classificationId,
      name: products.name,
      sellingUnit: products.sellingUnit,
      cropType: products.cropType,
      classification: classifications.name,
      quantityKg: sql<string>`${inventory.quantityKg} - ${inventory.reservedKg}`,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
    .where(sql`${inventory.quantityKg} - ${inventory.reservedKg} > 0`)
    .orderBy(
      asc(products.name),
      asc(classifications.name),
      asc(inventory.receivedAt),
      asc(inventory.id),
    );

  // Receiving can create several batches for the same product and quality.
  // Let the marketer choose one combined product-quality group, not a farmer batch.
  const grouped = new Map<
    string,
    Omit<(typeof rows)[number], "productId" | "classificationId" | "quantityKg"> & {
      quantityKg: number;
    }
  >();
  for (const row of rows) {
    const key = `${row.productId}:${row.classificationId}`;
    const current = grouped.get(key);
    if (current) {
      current.quantityKg += Number(row.quantityKg);
    } else {
      const { productId: _productId, classificationId: _classificationId, ...item } = row;
      grouped.set(key, { ...item, quantityKg: Number(row.quantityKg) });
    }
  }
  return [...grouped.values()].map((item) => ({ ...item, farmer: null }));
});

export const createMarketplaceListing = createServerFn({ method: "POST" })
  .validator(createListingInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { classifications, inventory, listings } = await import("@/db/schema");
    const created = await db.transaction(async (tx) => {
      const [stock] = await tx
        .select({
          id: inventory.id,
          productId: inventory.productId,
          classificationId: inventory.classificationId,
          classification: classifications.name,
          quantityKg: inventory.quantityKg,
          reservedKg: inventory.reservedKg,
        })
        .from(inventory)
        .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
        .where(eq(inventory.id, data.inventoryId));
      if (!stock || Number(stock.quantityKg) - Number(stock.reservedKg) <= 0)
        throw new Error("Select classified inventory created from a saved delivery.");
      const [existing] = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(
          and(
            eq(listings.productId, stock.productId),
            eq(listings.classificationId, stock.classificationId),
          ),
        )
        .limit(1);
      if (existing) {
        await tx
          .update(listings)
          .set({
            pricePerKg: data.retailPricePerKg.toFixed(2),
            retailPricePerKg: data.retailPricePerKg.toFixed(2),
            priceConfigured: true,
            bundlePricePerKg:
              data.bundlePricePerKg === null ? null : data.bundlePricePerKg.toFixed(2),
            bundleMinimumKg: data.bundleMinimumKg === null ? null : data.bundleMinimumKg.toFixed(2),
            status: data.status,
            inventoryId: data.inventoryId,
          })
          .where(eq(listings.id, existing.id));
        return { listingId: existing.id, inventoryId: data.inventoryId, updated: true };
      }
      const listingId = crypto.randomUUID();
      await tx.insert(listings).values({
        id: listingId,
        inventoryId: data.inventoryId,
        productId: stock.productId,
        classificationId: stock.classificationId,
        // price_per_kg remains the retail fallback for older reports and existing integrations.
        pricePerKg: data.retailPricePerKg.toFixed(2),
        retailPricePerKg: data.retailPricePerKg.toFixed(2),
        priceConfigured: true,
        bundlePricePerKg: data.bundlePricePerKg === null ? null : data.bundlePricePerKg.toFixed(2),
        bundleMinimumKg: data.bundleMinimumKg === null ? null : data.bundleMinimumKg.toFixed(2),
        status: data.status,
      });
      return { listingId, inventoryId: data.inventoryId, updated: false };
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
        priceConfigured: true,
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

/** Saves every Good/Semi/Reject setting in one transaction so refreshes cannot observe partial changes. */
export const saveMarketplaceProductOffers = createServerFn({ method: "POST" })
  .validator(saveMarketplaceProductOffersInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { classifications, listings, products } = await import("@/db/schema");
    const saved = await db.transaction(async (tx) => {
      const currentOffers = await tx
        .select({
          id: listings.id,
          productId: listings.productId,
          classification: classifications.name,
          productName: products.name,
          productActive: products.active,
          previousStatus: listings.status,
        })
        .from(listings)
        .innerJoin(classifications, eq(listings.classificationId, classifications.id))
        .innerJoin(products, eq(listings.productId, products.id))
        .where(
          and(
            eq(listings.productId, data.productId),
            inArray(
              listings.id,
              data.offers.map((offer) => offer.listingId),
            ),
          ),
        );
      if (currentOffers.length !== data.offers.length) {
        throw new Error("One or more marketplace offers could not be found.");
      }
      if (new Set(data.offers.map((offer) => offer.listingId)).size !== data.offers.length) {
        throw new Error("Each marketplace quality can only be saved once.");
      }
      if (currentOffers.some((offer) => !offer.productActive))
        throw new Error("Restore this product before changing its offer.");
      const results = [];
      for (const offer of data.offers) {
        const current = currentOffers.find((item) => item.id === offer.listingId)!;
        const status = offer.visible ? ("published" as const) : ("draft" as const);
        const priceConfigured = offer.retailPricePerKg !== null;
        const [updated] = await tx
          .update(listings)
          .set({
            pricePerKg: priceConfigured ? offer.retailPricePerKg!.toFixed(2) : "0.01",
            retailPricePerKg: priceConfigured ? offer.retailPricePerKg!.toFixed(2) : null,
            priceConfigured,
            bundlePricePerKg:
              !priceConfigured || offer.bundlePricePerKg === null
                ? null
                : offer.bundlePricePerKg.toFixed(2),
            bundleMinimumKg:
              !priceConfigured || offer.bundleMinimumKg === null
                ? null
                : offer.bundleMinimumKg.toFixed(2),
            status,
          })
          .where(eq(listings.id, offer.listingId));
        if (updated.affectedRows !== 1) {
          throw new Error(`${current.classification} settings could not be saved.`);
        }
        results.push({ ...current, ...offer, status });
      }
      return results;
    });

    await Promise.all(
      saved.map((offer) =>
        writeAuditLog(actor.id, "listing.settings.update", "marketplace_listing", offer.id, {
          retailPricePerKg: offer.retailPricePerKg,
          bundlePricePerKg: offer.bundlePricePerKg,
          bundleMinimumKg: offer.bundleMinimumKg,
          status: offer.status,
        }),
      ),
    );
    const { notifyCartHoldersForListing, notifyRole } =
      await import("@/services/messaging/notification-server");
    for (const offer of saved) {
      if (offer.previousStatus === offer.status) continue;
      if (offer.status === "published") {
        await notifyRole("Buyer", {
          title: "Marketplace offer available",
          message: `${offer.productName} — ${offer.classification} is now visible in the marketplace.`,
          target: "/marketplace",
        });
      } else {
        await notifyCartHoldersForListing(offer.id, {
          title: "Marketplace offer changed",
          message: `${offer.productName} — ${offer.classification} is no longer available. Review your cart before ordering.`,
          target: "/buyer/cart",
        });
      }
    }
    return saved.map((offer) => ({ id: offer.id, status: offer.status }));
  });

export const setMarketplaceListingStatus = createServerFn({ method: "POST" })
  .validator(listingStatusInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { classifications, listings, products } = await import("@/db/schema");
    const [listing] = await db
      .select({
        productId: listings.productId,
        classificationId: listings.classificationId,
        classification: classifications.name,
        productName: products.name,
        priceConfigured: listings.priceConfigured,
      })
      .from(listings)
      .innerJoin(classifications, eq(listings.classificationId, classifications.id))
      .innerJoin(products, eq(listings.productId, products.id))
      .where(eq(listings.id, data.listingId));
    if (!listing) throw new Error("The marketplace listing could not be found.");
    if (data.status === "published") {
      if (!listing.priceConfigured) {
        throw new Error("Save a valid retail price before making this quality visible.");
      }
      // Permanent offers may be published while sold out; receiving automatically
      // makes them purchasable without requiring another publish action.
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
    await expireAllBuyerCartReservations();
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
      productId: listings.productId,
      date: sql<string>`DATE(${dailyPrices.priceDate})`,
      product: products.name,
      cropType: products.cropType,
      sellingUnit: products.sellingUnit,
      description: products.description,
      imageUrl: products.imageUrl,
      classification: classifications.name,
      price: dailyPrices.price,
      published: dailyPrices.published,
      availableQuantity: sql<string>`(
        SELECT COALESCE(SUM(stock.quantity_kg - stock.reserved_kg), 0)
        FROM inventory AS stock
        WHERE stock.product_id = ${listings.productId}
          AND stock.classification_id = ${listings.classificationId}
      )`,
      createdAt: dailyPrices.createdAt,
    })
    .from(dailyPrices)
    .innerJoin(listings, eq(dailyPrices.listingId, listings.id))
    .innerJoin(products, eq(listings.productId, products.id))
    .innerJoin(classifications, eq(listings.classificationId, classifications.id))
    // A public price is only meaningful while its listing is buyer-visible and
    // has stock that can still be purchased. Marketers retain the full history
    // (including hidden, archived, and sold-out listing prices) in their view.
    .where(
      publicOnly
        ? and(
            eq(dailyPrices.published, true),
            eq(listings.status, "published"),
            sql`(
              SELECT COALESCE(SUM(stock.quantity_kg - stock.reserved_kg), 0)
              FROM inventory AS stock
              WHERE stock.product_id = ${listings.productId}
                AND stock.classification_id = ${listings.classificationId}
            ) > 0`,
          )
        : undefined,
    )
    .orderBy(asc(dailyPrices.priceDate));
  return rows.map((row) => ({
    ...row,
    classification: row.classification as Classification,
    price: Number(row.price),
    availableQuantity: Number(row.availableQuantity),
    createdAt: row.createdAt.toISOString(),
    status: row.published ? ("Published" as const) : ("Hidden" as const),
  }));
}

export const getPublicDailyPrices = createServerFn({ method: "GET" }).handler(async () =>
  fetchDailyPrices(true),
);

export const getMyDailyPriceAlerts = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const buyer = await requireRole("Buyer");
  const { db } = await import("@/db/client.server");
  const { dailyPriceAlerts } = await import("@/db/schema");
  const rows = await db
    .select()
    .from(dailyPriceAlerts)
    .where(eq(dailyPriceAlerts.buyerId, buyer.id));
  return rows.map((row) => ({
    ...row,
    targetPrice: Number(row.targetPrice),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastNotifiedAt: row.lastNotifiedAt?.toISOString() ?? null,
  }));
});

export const saveDailyPriceAlert = createServerFn({ method: "POST" })
  .validator(dailyPriceAlertInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const buyer = await requireRole("Buyer");
    const { db } = await import("@/db/client.server");
    const { dailyPriceAlerts, listings } = await import("@/db/schema");
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, data.listingId), eq(listings.status, "published")));
    if (!listing) throw new Error("This marketplace quality is no longer available.");
    const id = crypto.randomUUID();
    await db
      .insert(dailyPriceAlerts)
      .values({
        id,
        buyerId: buyer.id,
        listingId: data.listingId,
        targetPrice: data.targetPrice.toFixed(2),
        active: true,
        lastNotifiedAt: null,
      })
      .onDuplicateKeyUpdate({
        set: {
          targetPrice: data.targetPrice.toFixed(2),
          active: true,
          lastNotifiedAt: null,
          updatedAt: new Date(),
        },
      });
    await writeAuditLog(buyer.id, "daily_price_alert.save", "listing", data.listingId, {
      targetPrice: data.targetPrice,
    });
    return { listingId: data.listingId, targetPrice: data.targetPrice, active: true };
  });

async function notifyMatchingDailyPriceAlerts(
  listingId: string,
  productName: string,
  price: number,
  unit: SellingUnit,
) {
  const { db } = await import("@/db/client.server");
  const { dailyPriceAlerts } = await import("@/db/schema");
  const alerts = await db
    .select()
    .from(dailyPriceAlerts)
    .where(
      and(
        eq(dailyPriceAlerts.listingId, listingId),
        eq(dailyPriceAlerts.active, true),
        sql`${dailyPriceAlerts.targetPrice} >= ${price}`,
      ),
    );
  if (!alerts.length) return;
  const { notifyUser } = await import("@/services/messaging/notification-server");
  await Promise.all(
    alerts.map((alert) =>
      notifyUser(alert.buyerId, {
        title: `${productName} reached your target price`,
        message: `Now ₱${price.toFixed(2)} per ${sellingUnitLabel(unit)}.`,
        target: "/daily-prices",
      }),
    ),
  );
  await db
    .update(dailyPriceAlerts)
    .set({ active: false, lastNotifiedAt: new Date() })
    .where(
      inArray(
        dailyPriceAlerts.id,
        alerts.map((alert) => alert.id),
      ),
    );
}

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
    const { dailyPrices, listings, products } = await import("@/db/schema");
    const [listing] = await db
      .select({
        id: listings.id,
        status: listings.status,
        productName: products.name,
        sellingUnit: products.sellingUnit,
      })
      .from(listings)
      .innerJoin(products, eq(listings.productId, products.id))
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
        .set({
          price: data.price.toFixed(2),
          published: true,
          createdById: actor.id,
          createdAt: new Date(),
        })
        .where(eq(dailyPrices.id, existing.id));
      await writeAuditLog(actor.id, "daily_price.update", "daily_price", existing.id, data);
      const { notifyRole } = await import("@/services/messaging/notification-server");
      await notifyRole("Buyer", {
        title: "Daily price updated",
        message: `${listing.productName} is now ₱${data.price.toFixed(2)} per ${sellingUnitLabel(listing.sellingUnit)} for ${data.date}.`,
        target: "/daily-prices",
      });
      await notifyMatchingDailyPriceAlerts(
        data.listingId,
        listing.productName,
        data.price,
        listing.sellingUnit,
      );
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
      message: `${listing.productName} is ₱${data.price.toFixed(2)} per ${sellingUnitLabel(listing.sellingUnit)} for ${data.date}.`,
      target: "/daily-prices",
    });
    await notifyMatchingDailyPriceAlerts(
      data.listingId,
      listing.productName,
      data.price,
      listing.sellingUnit,
    );
    return { id, updated: false };
  });

export const setDailyPricePublished = createServerFn({ method: "POST" })
  .validator(dailyPriceStatusInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    const { db } = await import("@/db/client.server");
    const { dailyPrices, listings, products } = await import("@/db/schema");
    const [dailyPrice] = await db
      .select({ productName: products.name })
      .from(dailyPrices)
      .innerJoin(listings, eq(dailyPrices.listingId, listings.id))
      .innerJoin(products, eq(listings.productId, products.id))
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
      sellingUnit: products.sellingUnit,
      classification: classifications.name,
      pricePerKg: listings.pricePerKg,
      retailPricePerKg: listings.retailPricePerKg,
      bundlePricePerKg: listings.bundlePricePerKg,
      bundleMinimumKg: listings.bundleMinimumKg,
      quantityKg: cartItems.quantityKg,
      reservationExpiresAt: cartItems.reservationExpiresAt,
      availableKg: sql<string>`(
        SELECT COALESCE(SUM(stock.quantity_kg - stock.reserved_kg), 0)
        FROM inventory AS stock
        WHERE stock.product_id = ${listings.productId}
          AND stock.classification_id = ${listings.classificationId}
      )`,
      imageUrl: sql<string | null>`COALESCE(${listings.imageUrl}, ${products.imageUrl})`,
    })
    .from(carts)
    .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
    .innerJoin(listings, eq(cartItems.listingId, listings.id))
    .innerJoin(products, eq(listings.productId, products.id))
    .innerJoin(classifications, eq(listings.classificationId, classifications.id))
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
      reservationExpiresAt: row.reservationExpiresAt.toISOString(),
    };
  });
}

/** Reserve from the oldest available batches in one product-quality group. */
async function reserveListingStock(
  tx: MarketplaceTransaction,
  {
    listingId,
    quantityKg,
    referenceId,
    recordedById,
    note,
  }: {
    listingId: string;
    quantityKg: number;
    referenceId: string;
    recordedById: string;
    note: string;
  },
) {
  const { classifications, inventory, inventoryMovements, listings, products } =
    await import("@/db/schema");
  const [listing] = await tx
    .select({
      productId: listings.productId,
      classificationId: listings.classificationId,
      classification: classifications.name,
      sellingUnit: products.sellingUnit,
      status: listings.status,
      priceConfigured: listings.priceConfigured,
    })
    .from(listings)
    .innerJoin(products, eq(listings.productId, products.id))
    .innerJoin(classifications, eq(listings.classificationId, classifications.id))
    .where(eq(listings.id, listingId));
  if (!listing || listing.status !== "published" || !listing.priceConfigured) {
    throw new Error("This product is no longer available in the marketplace.");
  }
  if (requiresWholeSellingQuantity(listing.sellingUnit) && !Number.isInteger(quantityKg)) {
    throw new Error(`${sellingUnitLabel(listing.sellingUnit, 2)} must be ordered as whole units.`);
  }

  const batches = await tx
    .select({
      id: inventory.id,
      quantityKg: inventory.quantityKg,
      reservedKg: inventory.reservedKg,
    })
    .from(inventory)
    .where(
      and(
        eq(inventory.productId, listing.productId),
        eq(inventory.classificationId, listing.classificationId),
        sql`${inventory.quantityKg} - ${inventory.reservedKg} > 0`,
      ),
    )
    .orderBy(asc(inventory.receivedAt), asc(inventory.id))
    .for("update");
  const availableKg = batches.reduce(
    (total: number, batch: { quantityKg: string; reservedKg: string }) =>
      total + Math.max(0, Number(batch.quantityKg) - Number(batch.reservedKg)),
    0,
  );
  if (quantityKg > availableKg) {
    throw new Error(
      `Only ${availableKg} ${sellingUnitLabel(listing.sellingUnit, availableKg)} is currently available.`,
    );
  }

  let remainingKg = quantityKg;
  for (const batch of batches) {
    if (remainingKg <= 0) break;
    const reserveKg = Math.min(
      remainingKg,
      Math.max(0, Number(batch.quantityKg) - Number(batch.reservedKg)),
    );
    if (reserveKg <= 0) continue;
    const [reserved] = await tx
      .update(inventory)
      .set({ reservedKg: sql`${inventory.reservedKg} + ${reserveKg}` })
      .where(
        and(
          eq(inventory.id, batch.id),
          sql`${inventory.quantityKg} - ${inventory.reservedKg} >= ${reserveKg}`,
        ),
      );
    if (reserved.affectedRows !== 1) {
      throw new Error("Stock changed before your cart could be updated. Please try again.");
    }
    await tx.insert(inventoryMovements).values({
      id: crypto.randomUUID(),
      inventoryId: batch.id,
      movementType: "reservation",
      reservedChangeKg: reserveKg.toFixed(2),
      referenceType: "cart",
      referenceId,
      recordedById,
      note,
    });
    remainingKg -= reserveKg;
  }
}

/** Release a portion of the reservations attached to one cart item. */
async function releaseCartReservation(
  tx: MarketplaceTransaction,
  {
    cartItemId,
    quantityKg,
    recordedById,
    note,
  }: { cartItemId: string; quantityKg: number; recordedById: string; note: string },
) {
  const { inventory, inventoryMovements } = await import("@/db/schema");
  const movements = await tx
    .select({
      inventoryId: inventoryMovements.inventoryId,
      reservedChangeKg: inventoryMovements.reservedChangeKg,
    })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.referenceType, "cart"),
        eq(inventoryMovements.referenceId, cartItemId),
      ),
    )
    .for("update");
  const reservedByInventory = new Map<string, number>();
  for (const movement of movements) {
    reservedByInventory.set(
      movement.inventoryId,
      (reservedByInventory.get(movement.inventoryId) ?? 0) + Number(movement.reservedChangeKg),
    );
  }
  // Legacy carts may predate stock reservations. They have nothing to release,
  // so their expired cart row can be safely removed by the caller.
  if (reservedByInventory.size === 0) return;

  let remainingKg = quantityKg;
  for (const [inventoryId, reservedKg] of reservedByInventory) {
    if (remainingKg <= 0) break;
    const releaseKg = Math.min(remainingKg, Math.max(0, reservedKg));
    if (releaseKg <= 0) continue;
    const [released] = await tx
      .update(inventory)
      .set({ reservedKg: sql`${inventory.reservedKg} - ${releaseKg}` })
      .where(and(eq(inventory.id, inventoryId), sql`${inventory.reservedKg} >= ${releaseKg}`));
    if (released.affectedRows !== 1) {
      throw new Error("Reserved stock is inconsistent, so this cart item could not be updated.");
    }
    await tx.insert(inventoryMovements).values({
      id: crypto.randomUUID(),
      inventoryId,
      movementType: "release",
      reservedChangeKg: `-${releaseKg.toFixed(2)}`,
      referenceType: "cart",
      referenceId: cartItemId,
      recordedById,
      note,
    });
    remainingKg -= releaseKg;
  }
  if (remainingKg > 0.0001) {
    throw new Error("Reserved stock is inconsistent, so this cart item could not be updated.");
  }
}

/**
 * Cart items now reserve stock immediately. The movement row also lets existing
 * carts created before this behaviour be safely reserved once, without reserving
 * them again on every cart refresh.
 */
async function reserveExistingBuyerCartStock(buyerId: string) {
  const { db } = await import("@/db/client.server");
  const { cartItems, carts, classifications, inventory, listings } = await import("@/db/schema");

  await db.transaction(async (tx) => {
    // The same Buyer page can load the cart button and product details together.
    // Locking the cart first prevents both requests from reserving a legacy item.
    await tx.select({ id: carts.id }).from(carts).where(eq(carts.buyerId, buyerId)).for("update");
    const unreservedItems = await tx
      .select({
        cartItemId: cartItems.id,
        listingId: listings.id,
        quantityKg: cartItems.quantityKg,
      })
      .from(carts)
      .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
      .innerJoin(listings, eq(cartItems.listingId, listings.id))
      .where(
        and(
          eq(carts.buyerId, buyerId),
          sql`NOT EXISTS (
            SELECT 1
            FROM inventory_movements AS existing_reservation
            WHERE existing_reservation.reference_type = 'cart'
              AND existing_reservation.reference_id = ${cartItems.id}
              AND existing_reservation.movement_type = 'reservation'
          )`,
        ),
      )
      .for("update");

    for (const item of unreservedItems) {
      const [listing] = await tx
        .select({
          productId: listings.productId,
          classificationId: listings.classificationId,
          classification: classifications.name,
        })
        .from(listings)
        .innerJoin(classifications, eq(listings.classificationId, classifications.id))
        .where(eq(listings.id, item.listingId));
      if (!listing) {
        await tx.delete(cartItems).where(eq(cartItems.id, item.cartItemId));
        continue;
      }
      const [controllerListing] = await tx
        .select({ id: listings.id, status: listings.status })
        .from(listings)
        .where(
          and(
            eq(listings.productId, listing.productId),
            eq(listings.classificationId, listing.classificationId),
          ),
        )
        .limit(1);
      if (!controllerListing || controllerListing.status !== "published") {
        await tx.delete(cartItems).where(eq(cartItems.id, item.cartItemId));
        continue;
      }
      if (controllerListing.id !== item.listingId) {
        await tx
          .update(cartItems)
          .set({ listingId: controllerListing.id })
          .where(eq(cartItems.id, item.cartItemId));
      }
      const batches = await tx
        .select({ quantityKg: inventory.quantityKg, reservedKg: inventory.reservedKg })
        .from(inventory)
        .where(
          and(
            eq(inventory.productId, listing.productId),
            eq(inventory.classificationId, listing.classificationId),
            sql`${inventory.quantityKg} - ${inventory.reservedKg} > 0`,
          ),
        )
        .for("update");
      const availableKg = batches.reduce(
        (total: number, batch: { quantityKg: string; reservedKg: string }) =>
          total + Math.max(0, Number(batch.quantityKg) - Number(batch.reservedKg)),
        0,
      );
      const reservableKg = Math.min(Number(item.quantityKg), availableKg);
      if (reservableKg <= 0) {
        await tx.delete(cartItems).where(eq(cartItems.id, item.cartItemId));
        continue;
      }

      if (reservableKg < Number(item.quantityKg)) {
        await tx
          .update(cartItems)
          .set({ quantityKg: reservableKg.toFixed(2) })
          .where(eq(cartItems.id, item.cartItemId));
      }
      await reserveListingStock(tx, {
        listingId: controllerListing.id,
        quantityKg: reservableKg,
        referenceId: item.cartItemId,
        recordedById: buyerId,
        note: "Reserved in buyer cart from existing cart data.",
      });
    }
  });
}

/** Releases cart stock that was held for more than ten minutes without checkout. */
async function expireBuyerCartReservations(buyerId: string) {
  const { db } = await import("@/db/client.server");
  const { cartItems, carts } = await import("@/db/schema");

  await db.transaction(async (tx) => {
    const [cart] = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.buyerId, buyerId))
      .for("update");
    if (!cart) return;

    const expiredItems = await tx
      .select({ id: cartItems.id, quantityKg: cartItems.quantityKg })
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cart.id),
          sql`${cartItems.reservationExpiresAt} <= CURRENT_TIMESTAMP`,
        ),
      )
      .for("update");

    for (const item of expiredItems) {
      await releaseCartReservation(tx, {
        cartItemId: item.id,
        quantityKg: Number(item.quantityKg),
        recordedById: buyerId,
        note: "Cart reservation expired after 10 minutes.",
      });
      await tx.delete(cartItems).where(eq(cartItems.id, item.id));
    }
  });
}

/**
 * Marketplace reads also clear expired holds, so stock returns even when the
 * original buyer closes their browser and never visits their cart again.
 */
async function expireAllBuyerCartReservations() {
  const { db } = await import("@/db/client.server");
  const { cartItems, carts } = await import("@/db/schema");
  const expiredCarts = await db
    .select({ buyerId: carts.buyerId })
    .from(carts)
    .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
    .where(sql`${cartItems.reservationExpiresAt} <= CURRENT_TIMESTAMP`);

  for (const buyerId of new Set(expiredCarts.map((cart) => cart.buyerId))) {
    await expireBuyerCartReservations(buyerId);
  }
}

async function prepareBuyerCart(buyerId: string) {
  // Older carts are reserved once before expiry is evaluated. This keeps every
  // release traceable and prevents historical cart lines from bypassing stock rules.
  await expireAllBuyerCartReservations();
  await reserveExistingBuyerCartStock(buyerId);
  await expireBuyerCartReservations(buyerId);
}

export const getBuyerCart = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const buyer = await requireRole("Buyer");
  await prepareBuyerCart(buyer.id);
  return buyerCartRows(buyer.id);
});

export const addBuyerCartItem = createServerFn({ method: "POST" })
  .validator(cartItemInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("@/services/auth/auth-server");
    const buyer = await requireRole("Buyer");
    await prepareBuyerCart(buyer.id);
    const { db } = await import("@/db/client.server");
    const { cartItems, carts } = await import("@/db/schema");
    await db.transaction(async (tx) => {
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
      const cartItemId = existing?.id ?? crypto.randomUUID();
      if (existing) {
        await tx
          .update(cartItems)
          .set({
            quantityKg: nextQuantity.toFixed(2),
            reservationExpiresAt: nextCartReservationExpiry(),
          })
          .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
      } else {
        await tx.insert(cartItems).values({
          id: cartItemId,
          cartId: cart.id,
          listingId: data.listingId,
          quantityKg: data.quantityKg.toFixed(2),
          reservationExpiresAt: nextCartReservationExpiry(),
        });
      }
      await reserveListingStock(tx, {
        listingId: data.listingId,
        quantityKg: data.quantityKg,
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
    await prepareBuyerCart(buyer.id);
    const { db } = await import("@/db/client.server");
    const { cartItems, carts, listings, products } = await import("@/db/schema");
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
      const currentQuantityKg = Number(existing.quantityKg);
      if (data.quantityKg === 0) {
        await releaseCartReservation(tx, {
          cartItemId: existing.id,
          quantityKg: currentQuantityKg,
          recordedById: buyer.id,
          note: "Removed from buyer cart.",
        });
        await tx
          .delete(cartItems)
          .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
        return;
      }
      const [listingUnit] = await tx
        .select({ sellingUnit: products.sellingUnit })
        .from(listings)
        .innerJoin(products, eq(listings.productId, products.id))
        .where(eq(listings.id, data.listingId));
      if (!listingUnit) throw new Error("That item is no longer available.");
      if (
        requiresWholeSellingQuantity(listingUnit.sellingUnit) &&
        !Number.isInteger(data.quantityKg)
      ) {
        throw new Error(
          `${sellingUnitLabel(listingUnit.sellingUnit, 2)} must be ordered as whole units.`,
        );
      }
      const differenceKg = data.quantityKg - currentQuantityKg;
      if (differenceKg > 0) {
        await reserveListingStock(tx, {
          listingId: data.listingId,
          quantityKg: differenceKg,
          referenceId: existing.id,
          recordedById: buyer.id,
          note: "Increased buyer cart reservation.",
        });
      } else if (differenceKg < 0) {
        await releaseCartReservation(tx, {
          cartItemId: existing.id,
          quantityKg: Math.abs(differenceKg),
          recordedById: buyer.id,
          note: "Reduced buyer cart reservation.",
        });
      }
      const [updated] = await tx
        .update(cartItems)
        .set({
          quantityKg: data.quantityKg.toFixed(2),
          reservationExpiresAt: nextCartReservationExpiry(),
        })
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, data.listingId)));
      if (updated.affectedRows !== 1) throw new Error("That item is no longer in your cart.");
    });
    return buyerCartRows(buyer.id);
  });

export const placeBuyerOrder = createServerFn({ method: "POST" })
  .validator(checkoutInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const buyer = await requireRole("Buyer");
    await prepareBuyerCart(buyer.id);
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
      deliverySettings,
      inventoryMovements,
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
        .select({
          id: cartItems.id,
          listingId: cartItems.listingId,
          quantityKg: cartItems.quantityKg,
        })
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, cart.id),
            inArray(cartItems.listingId, listingIds),
            sql`${cartItems.reservationExpiresAt} > CURRENT_TIMESTAMP`,
          ),
        );
      if (
        cartLines.length !== requestedItems.length ||
        requestedItems.some(
          (item) =>
            Number(cartLines.find((line) => line.listingId === item.listingId)?.quantityKg) !==
            item.quantityKg,
        )
      ) {
        throw new Error(
          "Your cart reservation expired. Refresh the marketplace and add the item again.",
        );
      }
      const cartItemIds = cartLines.map((line) => line.id);
      const reservationRows = cartItemIds.length
        ? await tx
            .select({
              cartItemId: inventoryMovements.referenceId,
              reservedChangeKg: inventoryMovements.reservedChangeKg,
            })
            .from(inventoryMovements)
            .where(
              and(
                eq(inventoryMovements.referenceType, "cart"),
                inArray(inventoryMovements.referenceId, cartItemIds),
              ),
            )
        : [];
      const reservedByCartItem = new Map<string, number>();
      for (const reservation of reservationRows) {
        if (!reservation.cartItemId) continue;
        reservedByCartItem.set(
          reservation.cartItemId,
          (reservedByCartItem.get(reservation.cartItemId) ?? 0) +
            Number(reservation.reservedChangeKg),
        );
      }
      for (const item of requestedItems) {
        const cartItem = cartLines.find((line) => line.listingId === item.listingId);
        if (!cartItem || (reservedByCartItem.get(cartItem.id) ?? 0) + 0.0001 < item.quantityKg) {
          throw new Error("Your cart reservation changed. Refresh it before placing the order.");
        }
      }
      const rows = await tx
        .select({
          listingId: listings.id,
          name: products.name,
          sellingUnit: products.sellingUnit,
          imageUrl: sql<string | null>`COALESCE(${listings.imageUrl}, ${products.imageUrl})`,
          classification: classifications.name,
          pricePerKg: listings.pricePerKg,
          retailPricePerKg: listings.retailPricePerKg,
          bundlePricePerKg: listings.bundlePricePerKg,
          bundleMinimumKg: listings.bundleMinimumKg,
        })
        .from(listings)
        .innerJoin(products, eq(listings.productId, products.id))
        .innerJoin(classifications, eq(listings.classificationId, classifications.id))
        .where(and(eq(listings.status, "published"), inArray(listings.id, listingIds)));

      if (rows.length !== requestedItems.length) {
        throw new Error("One or more selected listings are no longer available.");
      }

      const orderId = crypto.randomUUID();
      const orderNumber = `ORD-${new Date().getFullYear()}-${orderId.slice(0, 8).toUpperCase()}`;
      let productsTotal = 0;
      for (const item of requestedItems) {
        const row = rows.find((candidate) => candidate.listingId === item.listingId);
        if (!row) throw new Error("A selected listing could not be found.");
        productsTotal += item.quantityKg * listingUnitPrice(row, item.quantityKg);
      }
      const [settings] = await tx
        .select({
          flatFee: deliverySettings.flatFee,
          deliveryEnabled: deliverySettings.deliveryEnabled,
        })
        .from(deliverySettings)
        .where(eq(deliverySettings.id, 1));
      // These values are read on the server. A Buyer can never enable a paused
      // delivery option or set/reduce its fee from the browser.
      if (data.fulfillment === "delivery" && settings?.deliveryEnabled === false) {
        throw new Error("Delivery is temporarily unavailable. Please choose pickup instead.");
      }
      const deliveryFee = data.fulfillment === "delivery" ? Number(settings?.flatFee ?? 59) : 0;
      const totalAmount = productsTotal + deliveryFee;

      await tx.insert(orders).values({
        id: orderId,
        orderNumber,
        buyerId: buyer.id,
        status: "pending",
        fulfillmentMethod: data.fulfillment,
        fulfillmentStatus: "pending",
        contact: data.contact,
        pickupNote: data.pickupNote,
        recipientName: data.recipientName || null,
        deliveryAddress: data.deliveryAddress || null,
        preferredSchedule: data.preferredSchedule || null,
        deliveryInstructions: data.deliveryInstructions || null,
        deliveryFee: deliveryFee.toFixed(2),
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
          productName: row.name,
          classificationName: row.classification,
          sellingUnit: row.sellingUnit,
          imageUrl: row.imageUrl,
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
      const { orderFulfillmentHistory } = await import("@/db/schema");
      await tx.insert(orderFulfillmentHistory).values({
        id: crypto.randomUUID(),
        orderId,
        status: "pending",
        changedById: buyer.id,
        note:
          data.fulfillment === "delivery"
            ? "Buyer requested delivery."
            : "Buyer selected pickup at PROCY.",
        changedAt: new Date(),
      });

      // Keep the batch-level reservation trail when the cart becomes an order.
      await tx
        .update(inventoryMovements)
        .set({ referenceType: "order", referenceId: orderId, note: `Reserved for ${orderNumber}.` })
        .where(
          and(
            eq(inventoryMovements.referenceType, "cart"),
            inArray(inventoryMovements.referenceId, cartItemIds),
          ),
        );

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

export const getBuyerDeliveryFee = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Buyer");
  const { db } = await import("@/db/client.server");
  const { deliverySettings } = await import("@/db/schema");
  const [settings] = await db
    .select({
      flatFee: deliverySettings.flatFee,
      deliveryEnabled: deliverySettings.deliveryEnabled,
    })
    .from(deliverySettings)
    .where(eq(deliverySettings.id, 1));
  return {
    deliveryFee: Number(settings?.flatFee ?? 59),
    deliveryEnabled: settings?.deliveryEnabled ?? true,
  };
});

/** The Rider workspace may view delivery availability but cannot change checkout settings. */
export const getRiderDeliveryStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const rider = await requireRole("Rider");
  const { db } = await import("@/db/client.server");
  const { deliverySettings, orders, users } = await import("@/db/schema");
  const [[settings], assignments] = await Promise.all([
    db
      .select({
        flatFee: deliverySettings.flatFee,
        deliveryEnabled: deliverySettings.deliveryEnabled,
      })
      .from(deliverySettings)
      .where(eq(deliverySettings.id, 1))
      .limit(1),
    db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        buyer: users.displayName,
        contact: orders.contact,
        recipientName: orders.recipientName,
        deliveryAddress: orders.deliveryAddress,
        preferredSchedule: orders.preferredSchedule,
        deliveryInstructions: orders.deliveryInstructions,
        fulfillmentStatus: orders.fulfillmentStatus,
        totalAmount: orders.totalAmount,
      })
      .from(orders)
      .innerJoin(users, eq(orders.buyerId, users.id))
      .where(
        and(
          eq(orders.assignedRiderId, rider.id),
          eq(orders.fulfillmentMethod, "delivery"),
          inArray(orders.fulfillmentStatus, [
            "rider_assigned",
            "out_for_delivery",
            "delivery_failed",
            "rescheduled",
          ]),
        ),
      )
      .orderBy(asc(orders.createdAt)),
  ]);
  return {
    deliveryFee: Number(settings?.flatFee ?? 59),
    deliveryEnabled: settings?.deliveryEnabled ?? true,
    assignments: assignments.map((order) => ({
      ...order,
      totalAmount: Number(order.totalAmount),
    })),
  };
});

export const getRiderCompletedDeliveries = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const rider = await requireRole("Rider");
  const { db } = await import("@/db/client.server");
  const { codRemittances, orders, users } = await import("@/db/schema");
  const [deliveries, remittances] = await Promise.all([
    db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        buyer: users.displayName,
        contact: orders.contact,
        recipientName: orders.recipientName,
        deliveryAddress: orders.deliveryAddress,
        preferredSchedule: orders.preferredSchedule,
        deliveryInstructions: orders.deliveryInstructions,
        totalAmount: orders.totalAmount,
        fulfilledAt: orders.fulfilledAt,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(users, eq(orders.buyerId, users.id))
      .where(
        and(
          eq(orders.assignedRiderId, rider.id),
          eq(orders.fulfillmentMethod, "delivery"),
          eq(orders.fulfillmentStatus, "delivered"),
        ),
      )
      .orderBy(desc(orders.fulfilledAt), desc(orders.createdAt)),
    db
      .select({ orderId: codRemittances.orderId, status: codRemittances.status })
      .from(codRemittances)
      .where(eq(codRemittances.riderId, rider.id)),
  ]);
  return deliveries.map((order) => ({
    ...order,
    totalAmount: Number(order.totalAmount),
    deliveredAt: (order.fulfilledAt ?? order.createdAt).toISOString(),
    codRemittanceStatus:
      remittances.find((remittance) => remittance.orderId === order.orderId)?.status ?? null,
  }));
});

export const getManagementDeliveryOperations = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireRole } = await import("@/services/auth/auth-server");
    await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { deliveryAssignments, orders, roles, userRoles, users } = await import("@/db/schema");
    const [riders, deliveries, assignmentRows] = await Promise.all([
      db
        .select({ id: users.id, name: users.displayName })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(and(eq(roles.name, "Rider"), eq(users.active, true)))
        .orderBy(asc(users.displayName)),
      db
        .select({
          orderId: orders.id,
          orderNumber: orders.orderNumber,
          buyer: users.displayName,
          contact: orders.contact,
          recipientName: orders.recipientName,
          deliveryAddress: orders.deliveryAddress,
          preferredSchedule: orders.preferredSchedule,
          fulfillmentStatus: orders.fulfillmentStatus,
          assignedRiderId: orders.assignedRiderId,
          totalAmount: orders.totalAmount,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .innerJoin(users, eq(orders.buyerId, users.id))
        .where(
          and(
            eq(orders.fulfillmentMethod, "delivery"),
            inArray(orders.fulfillmentStatus, [
              "ready_for_dispatch",
              "rider_assigned",
              "out_for_delivery",
              "delivery_failed",
              "rescheduled",
              "delivered",
            ]),
          ),
        )
        .orderBy(desc(orders.createdAt)),
      db
        .select({
          orderId: deliveryAssignments.orderId,
          riderId: deliveryAssignments.riderId,
          reason: deliveryAssignments.reason,
          assignedAt: deliveryAssignments.assignedAt,
        })
        .from(deliveryAssignments)
        .orderBy(desc(deliveryAssignments.assignedAt)),
    ]);
    return {
      riders: riders.map((rider) => ({
        ...rider,
        activeAssignments: deliveries.filter(
          (delivery) =>
            delivery.assignedRiderId === rider.id &&
            !["delivered", "delivery_failed"].includes(delivery.fulfillmentStatus),
        ).length,
      })),
      deliveries: deliveries.map((order) => ({
        ...order,
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt.toISOString(),
        assignedRiderName: riders.find((rider) => rider.id === order.assignedRiderId)?.name ?? null,
        assignmentHistory: assignmentRows
          .filter((assignment) => assignment.orderId === order.orderId)
          .map((assignment) => ({
            ...assignment,
            riderName:
              riders.find((rider) => rider.id === assignment.riderId)?.name ?? "Inactive Rider",
            assignedAt: assignment.assignedAt.toISOString(),
          })),
      })),
    };
  },
);

export const assignDeliveryRider = createServerFn({ method: "POST" })
  .validator(assignRiderInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const manager = await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { deliveryAssignments, orderFulfillmentHistory, orders, roles, userRoles, users } =
      await import("@/db/schema");
    const assignment = await db.transaction(async (tx) => {
      const [rider] = await tx
        .select({ id: users.id, name: users.displayName })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(and(eq(users.id, data.riderId), eq(users.active, true), eq(roles.name, "Rider")));
      if (!rider) throw new Error("Choose an active Rider account.");
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, data.orderNumber));
      if (!order || order.fulfillmentMethod !== "delivery") {
        throw new Error("This delivery order could not be found.");
      }
      const isReassignment = Boolean(order.assignedRiderId && order.assignedRiderId !== rider.id);
      if (isReassignment && !data.reason) {
        throw new Error("Enter a reason before assigning a different Rider.");
      }
      const deliveryOtpCode = createDeliveryOtp();
      const [updated] = await tx
        .update(orders)
        .set({
          assignedRiderId: rider.id,
          fulfillmentStatus: "rider_assigned",
          deliveryOtpCode,
        })
        .where(
          and(
            eq(orders.id, order.id),
            inArray(orders.fulfillmentStatus, [
              "ready_for_dispatch",
              "rider_assigned",
              "delivery_failed",
              "rescheduled",
            ]),
          ),
        );
      if (updated.affectedRows !== 1) {
        throw new Error("The order must be Ready for dispatch before assigning a Rider.");
      }
      await tx.insert(deliveryAssignments).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        riderId: rider.id,
        assignedById: manager.id,
        reason: data.reason ?? (order.assignedRiderId ? "Delivery retry" : "Initial assignment"),
        assignedAt: new Date(),
      });
      await tx.insert(orderFulfillmentHistory).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        status: "rider_assigned",
        changedById: manager.id,
        note: `${rider.name} was assigned to this delivery.${data.reason ? ` Reason: ${data.reason}` : ""}`,
        changedAt: new Date(),
      });
      await writeAuditLog(manager.id, "delivery.assign_rider", "order", order.id, {
        orderNumber: order.orderNumber,
        riderId: rider.id,
        previousRiderId: order.assignedRiderId,
        reason: data.reason,
      });
      return {
        buyerId: order.buyerId,
        orderNumber: order.orderNumber,
        previousRiderId: order.assignedRiderId,
        rider,
        deliveryOtpCode,
      };
    });
    const { notifyUser } = await import("@/services/messaging/notification-server");
    const notifications = [
      notifyUser(assignment.rider.id, {
        title: "New delivery assignment",
        message: `${assignment.orderNumber} is ready for you to deliver.`,
        target: "/rider",
      }),
      notifyUser(assignment.buyerId, {
        title: "Rider assigned",
        message: `${assignment.rider.name} was assigned to ${assignment.orderNumber}. Delivery OTP: ${assignment.deliveryOtpCode}. Give this code only after receiving your order.`,
        target: "/buyer/orders",
      }),
    ];
    if (assignment.previousRiderId && assignment.previousRiderId !== assignment.rider.id) {
      notifications.push(
        notifyUser(assignment.previousRiderId, {
          title: "Delivery reassigned",
          message: `${assignment.orderNumber} was moved to another Rider.${data.reason ? ` Reason: ${data.reason}` : ""}`,
          target: "/rider",
        }),
      );
    }
    await Promise.all(notifications);
    return assignment;
  });

export const updateOrderFulfillment = createServerFn({ method: "POST" })
  .validator(fulfillmentStatusInput)
  .handler(async ({ data }) => {
    const { requireUser, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireUser();
    const { db } = await import("@/db/client.server");
    const { orderFulfillmentHistory, orders } = await import("@/db/schema");
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, data.orderNumber));
      if (!order) throw new Error("The requested order could not be found.");
      const marketer = actor.roles.includes("Marketer");
      const rider = actor.roles.includes("Rider") && order.assignedRiderId === actor.id;
      const expected: Record<typeof data.status, string[]> = {
        preparing: ["confirmed"],
        ready_for_pickup: ["preparing"],
        ready_for_dispatch: ["preparing"],
        out_for_delivery: ["rider_assigned"],
        picked_up: ["ready_for_pickup"],
      };
      const marketerStatus = ["preparing", "ready_for_pickup", "ready_for_dispatch", "picked_up"];
      const riderStatus = ["out_for_delivery"];
      if (
        (!marketer || !marketerStatus.includes(data.status)) &&
        (!rider || !riderStatus.includes(data.status))
      ) {
        throw new Error("You do not have permission for this fulfillment step.");
      }
      if (data.status === "ready_for_pickup" && order.fulfillmentMethod !== "pickup") {
        throw new Error("Delivery orders must be marked Ready for dispatch.");
      }
      if (data.status === "ready_for_dispatch" && order.fulfillmentMethod !== "delivery") {
        throw new Error("Pickup orders must be marked Ready for pickup.");
      }
      const now = new Date();
      const [updated] = await tx
        .update(orders)
        .set({
          fulfillmentStatus: data.status,
          ...(data.status === "picked_up" ? { fulfilledAt: now } : {}),
        })
        .where(
          and(
            eq(orders.id, order.id),
            inArray(orders.fulfillmentStatus, expected[data.status] as never[]),
          ),
        );
      if (updated.affectedRows !== 1) throw new Error("This step is no longer available.");
      const labels: Record<typeof data.status, string> = {
        preparing: "PROCY started preparing the order.",
        ready_for_pickup: "The order is ready for pickup.",
        ready_for_dispatch: "The order is ready for Rider assignment.",
        out_for_delivery: "The Rider started the delivery.",
        picked_up: "The Buyer received the pickup order.",
      };
      await tx.insert(orderFulfillmentHistory).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        status: data.status,
        changedById: actor.id,
        note: labels[data.status],
        changedAt: now,
      });
      await writeAuditLog(actor.id, `fulfillment.${data.status}`, "order", order.id, {
        orderNumber: order.orderNumber,
      });
      return { buyerId: order.buyerId, orderNumber: order.orderNumber, status: data.status };
    });
    const { notifyUser } = await import("@/services/messaging/notification-server");
    await notifyUser(result.buyerId, {
      title: result.status.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase()),
      message: `${result.orderNumber} fulfillment was updated.`,
      target: "/buyer/orders",
    });
    return result;
  });

export const submitDeliveryProof = createServerFn({ method: "POST" })
  .validator(deliveryProofInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const rider = await requireRole("Rider");
    const { db } = await import("@/db/client.server");
    const { codRemittances, deliveryAttempts, orderFulfillmentHistory, orders } =
      await import("@/db/schema");
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, data.orderNumber));
      if (!order || order.assignedRiderId !== rider.id || order.fulfillmentMethod !== "delivery") {
        throw new Error("This delivery is not assigned to your Rider account.");
      }
      if (order.fulfillmentStatus !== "out_for_delivery") {
        throw new Error("Start the delivery before submitting proof.");
      }
      if (!order.deliveryOtpCode || order.deliveryOtpCode !== data.otp) {
        throw new Error("The delivery OTP is incorrect.");
      }
      const now = new Date();
      const [updated] = await tx
        .update(orders)
        .set({ fulfillmentStatus: "delivered", fulfilledAt: now, deliveryOtpCode: null })
        .where(
          and(
            eq(orders.id, order.id),
            eq(orders.assignedRiderId, rider.id),
            eq(orders.fulfillmentStatus, "out_for_delivery"),
          ),
        );
      if (updated.affectedRows !== 1) throw new Error("This delivery was already updated.");
      await tx.insert(deliveryAttempts).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        riderId: rider.id,
        outcome: "delivered",
        recipientName: data.recipientName,
        attemptedAt: now,
      });
      await tx.insert(orderFulfillmentHistory).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        status: "delivered",
        changedById: rider.id,
        note: `Delivered to ${data.recipientName}. Buyer OTP was verified.`,
        changedAt: now,
      });
      await tx
        .insert(codRemittances)
        .values({
          id: crypto.randomUUID(),
          orderId: order.id,
          riderId: rider.id,
          amount: order.totalAmount,
          status: "collected",
          collectedAt: now,
        })
        .onDuplicateKeyUpdate({
          set: {
            riderId: rider.id,
            amount: order.totalAmount,
            status: "collected",
            collectedAt: now,
            submittedAt: null,
            verifiedAt: null,
            verifiedById: null,
            closedAt: null,
          },
        });
      await writeAuditLog(rider.id, "delivery.completion.submit", "order", order.id, {
        orderNumber: order.orderNumber,
        recipientName: data.recipientName,
      });
      return { buyerId: order.buyerId, orderNumber: order.orderNumber };
    });
    const { notifyRole, notifyUser } = await import("@/services/messaging/notification-server");
    await Promise.all([
      notifyUser(result.buyerId, {
        title: "Order delivered",
        message: `${result.orderNumber} was delivered with a verified Buyer OTP.`,
        target: "/buyer/orders",
      }),
      notifyRole("Marketer", {
        title: "Delivery completed",
        message: `${result.orderNumber} was delivered and can now be finalized as Sold.`,
        target: "/marketer/orders",
      }),
      notifyRole("Accounting", {
        title: "COD collected",
        message: `${result.orderNumber} is waiting for Rider cash submission.`,
        target: "/accounting/payments",
      }),
    ]);
    return result;
  });

export const reportDeliveryIssue = createServerFn({ method: "POST" })
  .validator(deliveryIssueInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const rider = await requireRole("Rider");
    if (data.outcome === "rescheduled" && !data.nextSchedule) {
      throw new Error("Enter the new delivery schedule.");
    }
    const { db } = await import("@/db/client.server");
    const { deliveryAttempts, orderFulfillmentHistory, orders } = await import("@/db/schema");
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, data.orderNumber));
      if (!order || order.assignedRiderId !== rider.id) {
        throw new Error("This delivery is not assigned to your Rider account.");
      }
      if (order.fulfillmentStatus !== "out_for_delivery") {
        throw new Error("Only an active delivery can be reported as unsuccessful.");
      }
      const now = new Date();
      const status = data.outcome === "rescheduled" ? "rescheduled" : "delivery_failed";
      await tx
        .update(orders)
        .set({ fulfillmentStatus: status })
        .where(and(eq(orders.id, order.id), eq(orders.fulfillmentStatus, "out_for_delivery")));
      await tx.insert(deliveryAttempts).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        riderId: rider.id,
        outcome: data.outcome,
        reasonNote: data.reasonNote,
        nextSchedule: data.nextSchedule ?? null,
        attemptedAt: now,
      });
      await tx.insert(orderFulfillmentHistory).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        status,
        changedById: rider.id,
        note: `${data.outcome.replaceAll("_", " ")}: ${data.reasonNote}${data.nextSchedule ? ` Next schedule: ${data.nextSchedule}` : ""}`,
        changedAt: now,
      });
      await writeAuditLog(rider.id, "delivery.attempt.failed", "order", order.id, {
        orderNumber: order.orderNumber,
        outcome: data.outcome,
        nextSchedule: data.nextSchedule,
      });
      return { buyerId: order.buyerId, orderNumber: order.orderNumber, status };
    });
    const { notifyRole, notifyUser } = await import("@/services/messaging/notification-server");
    await Promise.all([
      notifyUser(result.buyerId, {
        title: result.status === "rescheduled" ? "Delivery rescheduled" : "Delivery unsuccessful",
        message: `${result.orderNumber}: ${data.reasonNote}`,
        target: "/buyer/orders",
      }),
      notifyRole("Management", {
        title:
          result.status === "rescheduled" ? "Delivery rescheduled" : "Delivery needs attention",
        message: `${result.orderNumber}: ${data.reasonNote}`,
        target: "/management/deliveries",
      }),
    ]);
    return result;
  });

export const updateCodRemittance = createServerFn({ method: "POST" })
  .validator(codRemittanceInput)
  .handler(async ({ data }) => {
    const { requireUser, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireUser();
    const { db } = await import("@/db/client.server");
    const { codRemittances, orders, payments } = await import("@/db/schema");
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ remittance: codRemittances, order: orders })
        .from(codRemittances)
        .innerJoin(orders, eq(codRemittances.orderId, orders.id))
        .where(eq(orders.orderNumber, data.orderNumber));
      if (!row) throw new Error("The COD remittance could not be found.");
      const now = new Date();
      if (data.action === "submit") {
        if (!actor.roles.includes("Rider") || row.remittance.riderId !== actor.id) {
          throw new Error("Only the assigned Rider can submit this COD collection.");
        }
        if (row.remittance.status !== "collected")
          throw new Error("This cash was already submitted.");
        await tx
          .update(codRemittances)
          .set({ status: "submitted", submittedAt: now, notes: data.notes ?? null })
          .where(eq(codRemittances.id, row.remittance.id));
      } else {
        if (!actor.roles.includes("Accounting")) {
          throw new Error("Only Accounting can verify or close COD remittances.");
        }
        if (data.action === "verify") {
          if (row.remittance.status !== "submitted")
            throw new Error("The Rider must submit the cash first.");
          await tx
            .update(codRemittances)
            .set({
              status: "verified",
              verifiedAt: now,
              verifiedById: actor.id,
              notes: data.notes ?? row.remittance.notes,
            })
            .where(eq(codRemittances.id, row.remittance.id));
        } else {
          if (row.remittance.status !== "verified")
            throw new Error("Verify the remittance before closing it.");
          if (row.order.status !== "sold")
            throw new Error("The Marketer must finalize the delivered order as Sold first.");
          const existing = await tx
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.orderId, row.order.id));
          if (!existing.length) {
            const paymentNumber = `PAY-${now.getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
            await tx.insert(payments).values({
              id: crypto.randomUUID(),
              paymentNumber,
              orderId: row.order.id,
              method: "cash_on_delivery",
              amount: row.order.totalAmount,
              recordedById: actor.id,
              paidAt: now,
            });
          }
          await tx
            .update(codRemittances)
            .set({ status: "closed", closedAt: now, notes: data.notes ?? row.remittance.notes })
            .where(eq(codRemittances.id, row.remittance.id));
        }
      }
      await writeAuditLog(actor.id, `cod_remittance.${data.action}`, "order", row.order.id, {
        orderNumber: row.order.orderNumber,
        amount: Number(row.remittance.amount),
      });
      return {
        buyerId: row.order.buyerId,
        riderId: row.remittance.riderId,
        orderNumber: row.order.orderNumber,
        action: data.action,
      };
    });
    const { notifyUser } = await import("@/services/messaging/notification-server");
    if (result.action === "verify") {
      await notifyUser(result.riderId, {
        title: "COD cash verified",
        message: `Accounting verified your cash submission for ${result.orderNumber}.`,
        target: "/rider",
      });
    } else if (result.action === "close") {
      await Promise.all([
        notifyUser(result.buyerId, {
          title: "COD payment verified",
          message: `${result.orderNumber} payment and Rider remittance are now closed.`,
          target: "/buyer/orders",
        }),
        notifyUser(result.riderId, {
          title: "COD remittance closed",
          message: `${result.orderNumber} cash handoff was completed by Accounting.`,
          target: "/rider",
        }),
      ]);
    }
    return result;
  });

export const getAccountingCodRemittances = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Accounting");
  const { db } = await import("@/db/client.server");
  const { codRemittances, orders, users } = await import("@/db/schema");
  const rows = await db
    .select({
      id: codRemittances.id,
      orderNumber: orders.orderNumber,
      buyer: users.displayName,
      riderId: codRemittances.riderId,
      amount: codRemittances.amount,
      status: codRemittances.status,
      collectedAt: codRemittances.collectedAt,
      submittedAt: codRemittances.submittedAt,
      verifiedAt: codRemittances.verifiedAt,
      closedAt: codRemittances.closedAt,
      notes: codRemittances.notes,
      orderStatus: orders.status,
    })
    .from(codRemittances)
    .innerJoin(orders, eq(codRemittances.orderId, orders.id))
    .innerJoin(users, eq(orders.buyerId, users.id))
    .orderBy(desc(codRemittances.createdAt));
  const riderIds = [...new Set(rows.map((row) => row.riderId))];
  const riders = riderIds.length
    ? await db
        .select({ id: users.id, name: users.displayName })
        .from(users)
        .where(inArray(users.id, riderIds))
    : [];
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    riderName: riders.find((rider) => rider.id === row.riderId)?.name ?? "Rider",
    collectedAt: row.collectedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
  }));
});

export const getManagementDeliveryFee = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Management");
  const { db } = await import("@/db/client.server");
  const { deliverySettings } = await import("@/db/schema");
  const [settings] = await db
    .select({
      flatFee: deliverySettings.flatFee,
      deliveryEnabled: deliverySettings.deliveryEnabled,
    })
    .from(deliverySettings)
    .where(eq(deliverySettings.id, 1));
  return {
    deliveryFee: Number(settings?.flatFee ?? 59),
    deliveryEnabled: settings?.deliveryEnabled ?? true,
  };
});

export const updateManagementDeliveryFee = createServerFn({ method: "POST" })
  .validator(deliveryFeeInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const manager = await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { deliverySettings } = await import("@/db/schema");
    const fee = Math.round(data.deliveryFee * 100) / 100;
    await db
      .insert(deliverySettings)
      .values({ id: 1, flatFee: fee.toFixed(2), updatedById: manager.id })
      .onDuplicateKeyUpdate({
        set: { flatFee: fee.toFixed(2), updatedById: manager.id },
      });
    await writeAuditLog(manager.id, "delivery_fee.update", "delivery_settings", "1", { fee });
    return { deliveryFee: fee };
  });

export const updateManagementDeliveryAvailability = createServerFn({ method: "POST" })
  .validator(deliveryAvailabilityInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const manager = await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { deliverySettings } = await import("@/db/schema");
    await db
      .insert(deliverySettings)
      .values({
        id: 1,
        flatFee: "59.00",
        deliveryEnabled: data.deliveryEnabled,
        updatedById: manager.id,
      })
      .onDuplicateKeyUpdate({
        set: { deliveryEnabled: data.deliveryEnabled, updatedById: manager.id },
      });
    await writeAuditLog(
      manager.id,
      data.deliveryEnabled ? "delivery.enable" : "delivery.disable",
      "delivery_settings",
      "1",
      { enabled: data.deliveryEnabled },
    );
    return { deliveryEnabled: data.deliveryEnabled };
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
      fulfillmentMethod: orders.fulfillmentMethod,
      fulfillmentStatus: orders.fulfillmentStatus,
      totalAmount: orders.totalAmount,
      deliveryFee: orders.deliveryFee,
      contact: orders.contact,
      pickupNote: orders.pickupNote,
      recipientName: orders.recipientName,
      deliveryAddress: orders.deliveryAddress,
      preferredSchedule: orders.preferredSchedule,
      deliveryInstructions: orders.deliveryInstructions,
      fulfilledAt: orders.fulfilledAt,
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
    deliveryFee: Number(row.deliveryFee),
    paymentStatus: row.paymentId ? "Paid" : "Unpaid",
  }));
});

export const rebuildBuyerCartFromOrder = createServerFn({ method: "POST" })
  .validator(orderNumberInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const buyer = await requireRole("Buyer");
    await prepareBuyerCart(buyer.id);
    const { db } = await import("@/db/client.server");
    const { cartItems, carts, listings, orderItems, orders } = await import("@/db/schema");
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
      const activeListings = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(and(inArray(listings.id, listingIds), eq(listings.status, "published")));
      if (activeListings.length !== listingIds.length) {
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
        const existingItem = existingItems.find((item) => item.listingId === listingId);
        const existingKg = existingItem ? Number(existingItem.quantityKg) : undefined;
        const cartItemId = existingItem?.id ?? crypto.randomUUID();
        if (existingKg === undefined) {
          await tx.insert(cartItems).values({
            id: cartItemId,
            cartId: cart.id,
            listingId,
            quantityKg: requestedKg.toFixed(2),
            reservationExpiresAt: nextCartReservationExpiry(),
          });
        } else {
          await tx
            .update(cartItems)
            .set({
              quantityKg: (existingKg + requestedKg).toFixed(2),
              reservationExpiresAt: nextCartReservationExpiry(),
            })
            .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.listingId, listingId)));
        }
        await reserveListingStock(tx, {
          listingId,
          quantityKg: requestedKg,
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
      deliveryAttempts,
      inventory,
      listings,
      orderItems,
      orderFulfillmentHistory,
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
        fulfillmentMethod: orders.fulfillmentMethod,
        fulfillmentStatus: orders.fulfillmentStatus,
        contact: orders.contact,
        pickupNote: orders.pickupNote,
        recipientName: orders.recipientName,
        deliveryAddress: orders.deliveryAddress,
        preferredSchedule: orders.preferredSchedule,
        deliveryInstructions: orders.deliveryInstructions,
        assignedRiderId: orders.assignedRiderId,
        deliveryOtpCode: orders.deliveryOtpCode,
        fulfilledAt: orders.fulfilledAt,
        totalAmount: orders.totalAmount,
        deliveryFee: orders.deliveryFee,
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

    const [assignedRider] = order.assignedRiderId
      ? await db
          .select({ id: users.id, name: users.displayName })
          .from(users)
          .where(eq(users.id, order.assignedRiderId))
          .limit(1)
      : [];

    const [items, history, [deliveryProof]] = await Promise.all([
      db
        .select({
          listingId: orderItems.listingId,
          name: sql<string>`COALESCE(${orderItems.productName}, ${products.name})`,
          image: sql<string | null>`COALESCE(${orderItems.imageUrl}, ${products.imageUrl})`,
          classification: sql<string>`COALESCE(${orderItems.classificationName}, ${classifications.name})`,
          sellingUnit: orderItems.sellingUnit,
          quantityKg: orderItems.quantityKg,
          pricePerKg: orderItems.pricePerKg,
        })
        .from(orderItems)
        .innerJoin(listings, eq(orderItems.listingId, listings.id))
        .innerJoin(products, eq(listings.productId, products.id))
        .innerJoin(classifications, eq(listings.classificationId, classifications.id))
        .where(eq(orderItems.orderId, order.id)),
      db
        .select({
          status: orderFulfillmentHistory.status,
          note: orderFulfillmentHistory.note,
          changedAt: orderFulfillmentHistory.changedAt,
        })
        .from(orderFulfillmentHistory)
        .where(eq(orderFulfillmentHistory.orderId, order.id))
        .orderBy(asc(orderFulfillmentHistory.changedAt)),
      db
        .select({
          recipientName: deliveryAttempts.recipientName,
          proofPhotoUrl: deliveryAttempts.proofPhotoUrl,
          signatureUrl: deliveryAttempts.signatureUrl,
          latitude: deliveryAttempts.latitude,
          longitude: deliveryAttempts.longitude,
          attemptedAt: deliveryAttempts.attemptedAt,
        })
        .from(deliveryAttempts)
        .where(
          and(eq(deliveryAttempts.orderId, order.id), eq(deliveryAttempts.outcome, "delivered")),
        )
        .orderBy(desc(deliveryAttempts.attemptedAt))
        .limit(1),
    ]);

    return {
      orderNumber: order.orderNumber,
      buyer: order.buyerId === viewer.id ? "You" : order.buyerName,
      status: order.status,
      fulfillmentMethod: order.fulfillmentMethod,
      fulfillmentStatus: order.fulfillmentStatus,
      contact: order.contact,
      pickupNote: order.pickupNote,
      recipientName: order.recipientName,
      deliveryAddress: order.deliveryAddress,
      preferredSchedule: order.preferredSchedule,
      deliveryInstructions: order.deliveryInstructions,
      assignedRiderId: assignedRider?.id ?? null,
      assignedRiderName: assignedRider?.name ?? null,
      deliveryOtpCode: order.buyerId === viewer.id ? order.deliveryOtpCode : null,
      deliveryProof: deliveryProof
        ? {
            ...deliveryProof,
            latitude: deliveryProof.latitude ? Number(deliveryProof.latitude) : null,
            longitude: deliveryProof.longitude ? Number(deliveryProof.longitude) : null,
            attemptedAt: deliveryProof.attemptedAt.toISOString(),
          }
        : null,
      fulfilledAt: order.fulfilledAt?.toISOString(),
      totalAmount: Number(order.totalAmount),
      deliveryFee: Number(order.deliveryFee),
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
  const {
    classifications,
    inventory,
    inventoryMovements,
    listings,
    orderFulfillmentHistory,
    orderItems,
    orders,
    payments,
    products,
    users,
  } = await import("@/db/schema");
  const orderRows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      fulfillmentMethod: orders.fulfillmentMethod,
      fulfillmentStatus: orders.fulfillmentStatus,
      totalAmount: orders.totalAmount,
      deliveryFee: orders.deliveryFee,
      contact: orders.contact,
      pickupNote: orders.pickupNote,
      recipientName: orders.recipientName,
      deliveryAddress: orders.deliveryAddress,
      preferredSchedule: orders.preferredSchedule,
      deliveryInstructions: orders.deliveryInstructions,
      assignedRiderId: orders.assignedRiderId,
      fulfilledAt: orders.fulfilledAt,
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
  const orderIds = orderRows.map((order) => order.id);
  const [items, allocations, fulfillmentHistory] = await Promise.all([
    db
      .select({
        orderId: orderItems.orderId,
        listingId: orderItems.listingId,
        name: sql<string>`COALESCE(${orderItems.productName}, ${products.name})`,
        image: sql<string | null>`COALESCE(${orderItems.imageUrl}, ${products.imageUrl})`,
        classification: sql<string>`COALESCE(${orderItems.classificationName}, ${classifications.name})`,
        sellingUnit: orderItems.sellingUnit,
        quantityKg: orderItems.quantityKg,
        pricePerKg: orderItems.pricePerKg,
      })
      .from(orderItems)
      .innerJoin(listings, eq(orderItems.listingId, listings.id))
      .innerJoin(products, eq(listings.productId, products.id))
      .innerJoin(classifications, eq(listings.classificationId, classifications.id))
      .where(inArray(orderItems.orderId, orderIds)),
    db
      .select({
        orderId: inventoryMovements.referenceId,
        farmer: users.displayName,
        product: products.name,
        classification: classifications.name,
        quantityKg: inventoryMovements.reservedChangeKg,
        receivedAt: inventory.receivedAt,
      })
      .from(inventoryMovements)
      .innerJoin(inventory, eq(inventoryMovements.inventoryId, inventory.id))
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
      .leftJoin(users, eq(inventory.farmerId, users.id))
      .where(
        and(
          eq(inventoryMovements.referenceType, "order"),
          eq(inventoryMovements.movementType, "reservation"),
          inArray(inventoryMovements.referenceId, orderIds),
        ),
      ),
    db
      .select({
        orderId: orderFulfillmentHistory.orderId,
        status: orderFulfillmentHistory.status,
        note: orderFulfillmentHistory.note,
        changedAt: orderFulfillmentHistory.changedAt,
      })
      .from(orderFulfillmentHistory)
      .where(inArray(orderFulfillmentHistory.orderId, orderIds))
      .orderBy(asc(orderFulfillmentHistory.changedAt)),
  ]);
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
      farmer: "PROCY farmer members",
      product: first?.name ?? "Product",
      classification: first?.classification ?? "Good",
      quantity:
        lines.length === 1
          ? `${lines[0]!.quantityKg} ${sellingUnitLabel(lines[0]!.sellingUnit, lines[0]!.quantityKg)}`
          : `${lines.length} classified items`,
      total: new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
        Number(order.totalAmount),
      ),
      amount: Number(order.totalAmount),
      deliveryFee: Number(order.deliveryFee),
      status:
        `${order.status.charAt(0).toUpperCase()}${order.status.slice(1)}` as DemoOrder["status"],
      paymentStatus: order.paymentId ? "Paid" : "Unpaid",
      date: order.createdAt.toLocaleDateString("en-PH"),
      createdAt: order.createdAt.toISOString(),
      ...(order.confirmedAt ? { confirmedAt: order.confirmedAt.toISOString() } : {}),
      ...(order.soldAt ? { soldAt: order.soldAt.toISOString() } : {}),
      ...(order.paymentId ? { paymentId: order.paymentId } : {}),
      ...(order.paymentMethod ? { paymentMethod: order.paymentMethod } : {}),
      ...(order.paidAt ? { paidAt: order.paidAt.toISOString() } : {}),
      contact: order.contact,
      pickupNote: order.pickupNote,
      fulfillmentMethod: order.fulfillmentMethod,
      fulfillmentStatus: order.fulfillmentStatus,
      recipientName: order.recipientName,
      deliveryAddress: order.deliveryAddress,
      preferredSchedule: order.preferredSchedule,
      deliveryInstructions: order.deliveryInstructions,
      assignedRiderName: null,
      ...(order.fulfilledAt ? { fulfilledAt: order.fulfilledAt.toISOString() } : {}),
      items: lines,
      history: fulfillmentHistory
        .filter((entry) => entry.orderId === order.id)
        .map((entry) => ({
          status: entry.status.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase()),
          note: entry.note,
          changedAt: entry.changedAt.toISOString(),
        })),
      allocations: allocations
        .filter((allocation) => allocation.orderId === order.id)
        .map((allocation) => ({
          farmer: allocation.farmer ?? "Legacy stock",
          product: allocation.product,
          classification: allocation.classification,
          quantityKg: Number(allocation.quantityKg),
          receivedAt: allocation.receivedAt.toISOString(),
        })),
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
        sellingUnit: products.sellingUnit,
        active: products.active,
      })
      .from(products)
      .orderBy(asc(products.name)),
    db
      .select({
        id: inventory.id,
        name: products.name,
        cropType: products.cropType,
        sellingUnit: products.sellingUnit,
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
      .leftJoin(
        listings,
        and(
          eq(listings.productId, inventory.productId),
          eq(listings.classificationId, inventory.classificationId),
        ),
      )
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
      .leftJoin(
        listings,
        and(
          eq(listings.productId, inventory.productId),
          eq(listings.classificationId, inventory.classificationId),
        ),
      ),
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
      .innerJoin(products, eq(listings.productId, products.id))
      .innerJoin(classifications, eq(listings.classificationId, classifications.id)),
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
      .innerJoin(products, eq(listings.productId, products.id))
      .innerJoin(classifications, eq(listings.classificationId, classifications.id))
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
  const { classifications, inventory, listings, orders, payments, products, receivingRecords } =
    await import("@/db/schema");
  const [stock, received, databaseOrders, databasePayments] = await Promise.all([
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
      .leftJoin(
        listings,
        and(
          eq(listings.productId, inventory.productId),
          eq(listings.classificationId, inventory.classificationId),
        ),
      ),
    db.select({ totalKg: receivingRecords.totalKg }).from(receivingRecords),
    db
      .select({
        status: orders.status,
        createdAt: orders.createdAt,
        soldAt: orders.soldAt,
      })
      .from(orders),
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
  const demand = databaseOrders.filter(
    (order) => order.status === "pending" || order.status === "confirmed",
  ).length;
  const sold = databaseOrders.filter((order) => order.status === "sold").length;
  const qualityOrder = ["Good", "Semi", "Reject"] as const;
  const quality = qualityOrder.map((classification) => ({
    name: classification,
    value: stock
      .filter(
        (row) => row.classification.toLocaleLowerCase() === classification.toLocaleLowerCase(),
      )
      .reduce(
        (total, row) => total + Math.max(0, Number(row.quantityKg) - Number(row.reservedKg)),
        0,
      ),
  }));
  const stockByProduct = [
    ...stock.reduce((grouped, row) => {
      const available = Math.max(0, Number(row.quantityKg) - Number(row.reservedKg));
      grouped.set(row.name, (grouped.get(row.name) ?? 0) + available);
      return grouped;
    }, new Map<string, number>()),
  ]
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0)
    .sort((first, second) => second.value - first.value)
    .slice(0, 5);
  const formatDay = (date: Date) => date.toISOString().slice(0, 10);
  const activityByDay = new Map<string, { orders: number; sales: number }>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    activityByDay.set(formatDay(day), { orders: 0, sales: 0 });
  }
  for (const order of databaseOrders) {
    const orderDay = formatDay(order.createdAt);
    const orderActivity = activityByDay.get(orderDay);
    if (orderActivity) orderActivity.orders += 1;
    if (order.status === "sold" && order.soldAt) {
      const saleActivity = activityByDay.get(formatDay(order.soldAt));
      if (saleActivity) saleActivity.sales += 1;
    }
  }
  const activity = [...activityByDay.entries()].map(([date, value]) => ({
    date,
    label: new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short" }),
    ...value,
  }));
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
    dashboard: {
      activity,
      quality,
      stockByProduct,
    },
  };
});

/** Builds daily, current-month, and all-time Management views from saved operational records. */
export const getManagementDashboard = createServerFn({ method: "GET" })
  .validator(managementDashboardInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("@/services/auth/auth-server");
    await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const {
      classifications,
      inventory,
      inventoryMovements,
      orders,
      payments,
      products,
      receivingRecords,
    } = await import("@/db/schema");

    if (data.range === "day" && !data.date) {
      throw new Error("Choose a dashboard date.");
    }
    // Manila has no daylight-saving changes, so explicit +08:00 boundaries keep
    // dashboard periods consistent for users and for the Vercel server runtime.
    const dayStart = data.date ? new Date(`${data.date}T00:00:00+08:00`) : null;
    const dayEnd = dayStart ? new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) : null;
    const currentManilaMonth = Object.fromEntries(
      new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
      })
        .formatToParts(new Date())
        .map((part) => [part.type, part.value]),
    );
    const monthStart = new Date(
      `${currentManilaMonth["year"]}-${currentManilaMonth["month"]}-01T00:00:00+08:00`,
    );
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    const manilaYear = (date: Date) =>
      Number(
        new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric" }).format(date),
      );
    const occursInSelectedPeriod = (date: Date | null) => {
      if (!date) return false;
      if (data.range === "all") {
        return !data.year || manilaYear(date) === data.year;
      }
      if (data.range === "month") return date >= monthStart && date < monthEnd;
      return Boolean(dayStart && dayEnd && date >= dayStart && date < dayEnd);
    };

    const [stockRows, movements, received, databaseOrders, databasePayments] = await Promise.all([
      db
        .select({
          id: inventory.id,
          name: products.name,
          classification: classifications.name,
        })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .innerJoin(classifications, eq(inventory.classificationId, classifications.id)),
      db
        .select({
          inventoryId: inventoryMovements.inventoryId,
          movementType: inventoryMovements.movementType,
          availableChangeKg: inventoryMovements.availableChangeKg,
          createdAt: inventoryMovements.createdAt,
        })
        .from(inventoryMovements),
      db
        .select({ totalKg: receivingRecords.totalKg, receivedAt: receivingRecords.receivedAt })
        .from(receivingRecords),
      db
        .select({ status: orders.status, createdAt: orders.createdAt, soldAt: orders.soldAt })
        .from(orders),
      db.select({ amount: payments.amount, paidAt: payments.paidAt }).from(payments),
    ]);
    const availableYears = Array.from(
      new Set([
        Number(currentManilaMonth["year"]),
        ...movements.map((row) => manilaYear(row.createdAt)),
        ...received.map((row) => manilaYear(row.receivedAt)),
        ...databaseOrders.map((row) => manilaYear(row.createdAt)),
        ...databaseOrders.flatMap((row) => (row.soldAt ? [manilaYear(row.soldAt)] : [])),
        ...databasePayments.map((row) => manilaYear(row.paidAt)),
      ]),
    ).sort((first, second) => second - first);

    const selectedReceiving = received.filter((row) => occursInSelectedPeriod(row.receivedAt));
    const selectedOrders = databaseOrders.filter((order) =>
      occursInSelectedPeriod(order.createdAt),
    );
    const selectedSales = databaseOrders.filter(
      (order) => order.status === "sold" && occursInSelectedPeriod(order.soldAt),
    );
    const selectedPayments = databasePayments.filter((payment) =>
      occursInSelectedPeriod(payment.paidAt),
    );
    const supplyKg = selectedReceiving.reduce((total, row) => total + Number(row.totalKg), 0);
    const stockById = new Map(stockRows.map((row) => [row.id, row]));
    const selectedStockActivity = movements
      .filter(
        (movement) =>
          occursInSelectedPeriod(movement.createdAt) && Number(movement.availableChangeKg) > 0,
      )
      .flatMap((movement) => {
        const stock = stockById.get(movement.inventoryId);
        return stock
          ? [
              {
                ...stock,
                addedKg: Number(movement.availableChangeKg),
                createdAt: movement.createdAt,
              },
            ]
          : [];
      });
    const stockKg = selectedStockActivity.reduce((total, row) => total + row.addedKg, 0);
    const salesAmount = selectedPayments.reduce(
      (total, payment) => total + Number(payment.amount),
      0,
    );
    const periodLabel =
      data.range === "all"
        ? "across all time"
        : data.range === "month"
          ? "this month"
          : "on this day";
    const qualityOrder = ["Good", "Semi", "Reject"] as const;
    const quality = qualityOrder.map((classification) => ({
      name: classification,
      value: selectedStockActivity
        .filter((row) => row.classification === classification)
        .reduce((total, row) => total + row.addedKg, 0),
    }));
    const manilaMonthKey = (date: Date) => {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "2-digit",
        })
          .formatToParts(date)
          .map((part) => [part.type, part.value]),
      );
      return `${parts["year"]}-${parts["month"]}`;
    };
    const monthLabel = (key: string) =>
      new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Manila",
        month: "short",
        year: "numeric",
      }).format(new Date(`${key}-01T00:00:00+08:00`));
    const monthKeysBetween = (dates: Date[]) => {
      if (data.range === "all" && data.year) {
        return Array.from(
          { length: 12 },
          (_, index) => `${data.year}-${String(index + 1).padStart(2, "0")}`,
        );
      }
      const keys = dates.map(manilaMonthKey).sort();
      const currentYear = Number(currentManilaMonth["year"]);
      const firstYear = keys.length > 0 ? Number(keys[0]!.slice(0, 4)) : currentYear;
      const lastYear =
        keys.length > 0
          ? Math.max(Number(keys[keys.length - 1]!.slice(0, 4)), currentYear)
          : currentYear;
      const result: string[] = [];
      for (let year = firstYear; year <= lastYear; year += 1) {
        for (let month = 1; month <= 12; month += 1) {
          result.push(`${year}-${String(month).padStart(2, "0")}`);
        }
      }
      return result;
    };
    const hourlyActivity = () => {
      const byHour = new Map<number, { orders: number; sales: number }>();
      for (let hour = 0; hour < 24; hour += 1) byHour.set(hour, { orders: 0, sales: 0 });
      for (const order of selectedOrders) {
        const hour = (order.createdAt.getUTCHours() + 8) % 24;
        byHour.get(hour)!.orders += 1;
      }
      for (const sale of selectedSales) {
        if (!sale.soldAt) continue;
        const hour = (sale.soldAt.getUTCHours() + 8) % 24;
        byHour.get(hour)!.sales += 1;
      }
      return [...byHour.entries()].map(([hour, value]) => ({
        label: `${hour === 0 || hour === 12 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`,
        ...value,
      }));
    };
    const dailyActivity = () => {
      const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86_400_000);
      const byDay = new Map<number, { orders: number; sales: number }>();
      for (let day = 1; day <= daysInMonth; day += 1) byDay.set(day, { orders: 0, sales: 0 });
      const dayOfMonth = (date: Date) =>
        Number(
          new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", day: "numeric" }).format(date),
        );
      for (const order of selectedOrders) byDay.get(dayOfMonth(order.createdAt))!.orders += 1;
      for (const sale of selectedSales) {
        if (sale.soldAt) byDay.get(dayOfMonth(sale.soldAt))!.sales += 1;
      }
      const monthName = new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Manila",
        month: "short",
      }).format(monthStart);
      return [...byDay.entries()].map(([day, value]) => ({
        label: `${monthName} ${day}`,
        ...value,
      }));
    };
    const monthlyActivity = () => {
      const keys = monthKeysBetween([
        ...selectedOrders.map((row) => row.createdAt),
        ...selectedSales.flatMap((row) => (row.soldAt ? [row.soldAt] : [])),
      ]);
      const byMonth = new Map(keys.map((key) => [key, { orders: 0, sales: 0 }]));
      for (const order of selectedOrders) byMonth.get(manilaMonthKey(order.createdAt))!.orders += 1;
      for (const sale of selectedSales) {
        if (sale.soldAt) byMonth.get(manilaMonthKey(sale.soldAt))!.sales += 1;
      }
      return [...byMonth.entries()].map(([key, value]) => ({ label: monthLabel(key), ...value }));
    };
    const activity =
      data.range === "all"
        ? monthlyActivity()
        : data.range === "month"
          ? dailyActivity()
          : hourlyActivity();
    const hourlyInventoryFlow = () => {
      const byHour = new Map<number, { stock: number; supply: number }>();
      for (let hour = 0; hour < 24; hour += 1) byHour.set(hour, { stock: 0, supply: 0 });
      for (const row of selectedStockActivity) {
        const hour = (row.createdAt.getUTCHours() + 8) % 24;
        byHour.get(hour)!.stock += row.addedKg;
      }
      for (const row of selectedReceiving) {
        const hour = (row.receivedAt.getUTCHours() + 8) % 24;
        byHour.get(hour)!.supply += Number(row.totalKg);
      }
      return [...byHour.entries()].map(([hour, value]) => ({
        label: `${hour === 0 || hour === 12 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`,
        ...value,
      }));
    };
    const dailyInventoryFlow = () => {
      const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86_400_000);
      const byDay = new Map<number, { stock: number; supply: number }>();
      for (let day = 1; day <= daysInMonth; day += 1) byDay.set(day, { stock: 0, supply: 0 });
      const dayOfMonth = (date: Date) =>
        Number(
          new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", day: "numeric" }).format(date),
        );
      for (const row of selectedStockActivity)
        byDay.get(dayOfMonth(row.createdAt))!.stock += row.addedKg;
      for (const row of selectedReceiving)
        byDay.get(dayOfMonth(row.receivedAt))!.supply += Number(row.totalKg);
      const monthName = new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Manila",
        month: "short",
      }).format(monthStart);
      return [...byDay.entries()].map(([day, value]) => ({
        label: `${monthName} ${day}`,
        ...value,
      }));
    };
    const monthlyInventoryFlow = () => {
      const keys = monthKeysBetween([
        ...selectedStockActivity.map((row) => row.createdAt),
        ...selectedReceiving.map((row) => row.receivedAt),
      ]);
      const byMonth = new Map(keys.map((key) => [key, { stock: 0, supply: 0 }]));
      for (const row of selectedStockActivity) {
        byMonth.get(manilaMonthKey(row.createdAt))!.stock += row.addedKg;
      }
      for (const row of selectedReceiving) {
        byMonth.get(manilaMonthKey(row.receivedAt))!.supply += Number(row.totalKg);
      }
      return [...byMonth.entries()].map(([key, value]) => ({ label: monthLabel(key), ...value }));
    };
    const inventoryFlow =
      data.range === "all"
        ? monthlyInventoryFlow()
        : data.range === "month"
          ? dailyInventoryFlow()
          : hourlyInventoryFlow();
    const recentActivity = [
      ...selectedReceiving.map((row) => ({
        kind: "receiving",
        title: "Farmer delivery recorded",
        detail: `${Number(row.totalKg)} kg added to receiving`,
        time: row.receivedAt.toISOString(),
      })),
      ...selectedOrders.map((row) => ({
        kind: "order",
        title: "Buyer order received",
        detail: "New marketplace order created",
        time: row.createdAt.toISOString(),
      })),
      ...selectedSales.flatMap((row) =>
        row.soldAt
          ? [
              {
                kind: "sale",
                title: "Sale recorded",
                detail: "PROCY order marked as sold",
                time: row.soldAt.toISOString(),
              },
            ]
          : [],
      ),
      ...selectedPayments.map((row) => ({
        kind: "payment",
        title: "Payment recorded",
        detail: `₱${Number(row.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })} payment entry added`,
        time: row.paidAt.toISOString(),
      })),
      ...selectedStockActivity.map((row) => ({
        kind: "stock",
        title: "Marketplace stock updated",
        detail: `${row.addedKg} kg classified stock added`,
        time: row.createdAt.toISOString(),
      })),
    ]
      .sort((first, second) => new Date(second.time).getTime() - new Date(first.time).getTime())
      .slice(0, 5);

    return {
      range: data.range,
      date: data.range === "day" ? data.date : null,
      selectedYear: data.range === "all" ? (data.year ?? Number(currentManilaMonth["year"])) : null,
      availableYears,
      summaries: [
        {
          label: "Stock added",
          value: `${stockKg} kg`,
          detail: `Classified stock recorded ${periodLabel}`,
        },
        {
          label: "Supply received",
          value: `${supplyKg} kg`,
          detail: `Farmer deliveries recorded ${periodLabel}`,
        },
        {
          label: "Sales completed",
          value: `${selectedSales.length} sale${selectedSales.length === 1 ? "" : "s"}`,
          detail: `Orders fulfilled ${periodLabel}`,
        },
        {
          label: "Buyer orders",
          value: `${selectedOrders.length} order${selectedOrders.length === 1 ? "" : "s"}`,
          detail: `Orders submitted ${periodLabel}`,
        },
      ],
      paymentTotal: salesAmount,
      paymentCount: selectedPayments.length,
      dashboard: { activity, inventoryFlow, quality, recentActivity },
    };
  });

export const getMarketerDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Marketer");
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, listings, orders, products, receivingRecords } =
    await import("@/db/schema");
  const [receiving, stock, publishedListings, pendingOrders, lowStock] = await Promise.all([
    db
      .select({ totalKg: receivingRecords.totalKg, sellingUnit: products.sellingUnit })
      .from(receivingRecords)
      .innerJoin(products, eq(receivingRecords.productId, products.id)),
    db
      .select({
        quantityKg: inventory.quantityKg,
        reservedKg: inventory.reservedKg,
        sellingUnit: products.sellingUnit,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id)),
    db.select({ id: listings.id }).from(listings).where(eq(listings.status, "published")),
    db.select({ id: orders.id }).from(orders).where(eq(orders.status, "pending")),
    db
      .select({
        id: inventory.id,
        name: products.name,
        classification: classifications.name,
        sellingUnit: products.sellingUnit,
        availableKg: sql<string>`${inventory.quantityKg} - ${inventory.reservedKg}`,
      })
      .from(inventory)
      .innerJoin(
        listings,
        and(
          eq(listings.productId, inventory.productId),
          eq(listings.classificationId, inventory.classificationId),
        ),
      )
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
      .where(
        and(
          eq(listings.status, "published"),
          sql`${inventory.quantityKg} - ${inventory.reservedKg} <= 5`,
        ),
      ),
  ]);
  const receivedKg = receiving
    .filter((row) => row.sellingUnit === "kg")
    .reduce((total, row) => total + Number(row.totalKg), 0);
  const receivedTrays = receiving
    .filter((row) => row.sellingUnit === "tray")
    .reduce((total, row) => total + Number(row.totalKg), 0);
  const availableKg = stock
    .filter((row) => row.sellingUnit === "kg")
    .reduce(
      (total, row) => total + Math.max(0, Number(row.quantityKg) - Number(row.reservedKg)),
      0,
    );
  const availableTrays = stock
    .filter((row) => row.sellingUnit === "tray")
    .reduce(
      (total, row) => total + Math.max(0, Number(row.quantityKg) - Number(row.reservedKg)),
      0,
    );
  const unitTotals = sellingUnits.map((unit) => ({
    unit,
    received: receiving
      .filter((row) => row.sellingUnit === unit)
      .reduce((total, row) => total + Number(row.totalKg), 0),
    available: stock
      .filter((row) => row.sellingUnit === unit)
      .reduce(
        (total, row) => total + Math.max(0, Number(row.quantityKg) - Number(row.reservedKg)),
        0,
      ),
  }));
  return {
    receivedKg,
    receivedTrays,
    publishedListings: publishedListings.length,
    availableKg,
    availableTrays,
    unitTotals,
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
    const { orderFulfillmentHistory, orderStatusHistory, orders } = await import("@/db/schema");
    const confirmedOrder = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, data.orderNumber));
      if (!order) throw new Error("The requested order could not be found.");
      const now = new Date();
      const [transition] = await tx
        .update(orders)
        .set({ status: "confirmed", fulfillmentStatus: "confirmed", confirmedAt: now })
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
      await tx.insert(orderFulfillmentHistory).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        status: "confirmed",
        changedById: actor.id,
        note: "Marketer confirmed the order and reserved stock.",
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
    const {
      inventory,
      inventoryMovements,
      listings,
      orderItems,
      orderFulfillmentHistory,
      orderStatusHistory,
      orders,
    } = await import("@/db/schema");
    const soldOrder = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, data.orderNumber));
      if (!order) throw new Error("The requested order could not be found.");
      if (!["picked_up", "delivered"].includes(order.fulfillmentStatus)) {
        throw new Error(
          order.fulfillmentMethod === "delivery"
            ? "The Rider must mark this order Delivered before it can be finalized as Sold."
            : "Mark this order Picked up before finalizing it as Sold.",
        );
      }
      const now = new Date();
      const [transition] = await tx
        .update(orders)
        .set({ status: "sold", soldAt: now })
        .where(and(eq(orders.id, order.id), eq(orders.status, "confirmed")));
      if (transition.affectedRows !== 1) {
        throw new Error("Only an unchanged Confirmed order can be marked Sold.");
      }
      const reservationMovements = await tx
        .select({
          inventoryId: inventoryMovements.inventoryId,
          reservedChangeKg: inventoryMovements.reservedChangeKg,
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.referenceType, "order"),
            eq(inventoryMovements.referenceId, order.id),
          ),
        );
      const reservedByInventory = new Map<string, number>();
      for (const movement of reservationMovements) {
        reservedByInventory.set(
          movement.inventoryId,
          (reservedByInventory.get(movement.inventoryId) ?? 0) + Number(movement.reservedChangeKg),
        );
      }
      let lines = [...reservedByInventory.entries()]
        .filter(([, quantityKg]) => quantityKg > 0)
        .map(([inventoryId, quantityKg]) => ({ inventoryId, quantityKg: quantityKg.toFixed(2) }));
      // Orders created before grouped stock reservations used their listing's one batch.
      if (!lines.length)
        lines = await tx
          .select({
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
    const {
      inventory,
      inventoryMovements,
      listings,
      orderItems,
      orderFulfillmentHistory,
      orderStatusHistory,
      orders,
    } = await import("@/db/schema");

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
        .set({ status: data.outcome, fulfillmentStatus: data.outcome })
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

      const reservationMovements = await tx
        .select({
          inventoryId: inventoryMovements.inventoryId,
          reservedChangeKg: inventoryMovements.reservedChangeKg,
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.referenceType, "order"),
            eq(inventoryMovements.referenceId, order.id),
          ),
        );
      const reservedByInventory = new Map<string, number>();
      for (const movement of reservationMovements) {
        reservedByInventory.set(
          movement.inventoryId,
          (reservedByInventory.get(movement.inventoryId) ?? 0) +
            Number(movement.reservedChangeKg ?? 0),
        );
      }
      let lines = [...reservedByInventory.entries()]
        .filter(([, quantityKg]) => quantityKg > 0)
        .map(([inventoryId, quantityKg]) => ({ inventoryId, quantityKg: quantityKg.toFixed(2) }));

      // Orders created before combined stock reservations existed have no
      // per-batch movement history. Keep their original listing batch as the
      // safe fallback so historic orders remain cancellable.
      if (!lines.length) {
        lines = await tx
          .select({ inventoryId: inventory.id, quantityKg: orderItems.quantityKg })
          .from(orderItems)
          .innerJoin(listings, eq(orderItems.listingId, listings.id))
          .innerJoin(inventory, eq(listings.inventoryId, inventory.id))
          .where(eq(orderItems.orderId, order.id));
      }
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
      await tx.insert(orderFulfillmentHistory).values({
        id: crypto.randomUUID(),
        orderId: order.id,
        status: data.outcome,
        changedById: actor.id,
        note: data.reason ?? `Order ${data.outcome}. Fulfillment stopped.`,
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
      if (data.method === "cash_on_delivery" && order.fulfillmentMethod !== "delivery") {
        throw new Error("Cash on Delivery can only be recorded for a Delivery order.");
      }
      if (data.method === "cash_on_delivery") {
        throw new Error("Use the Rider COD remittance queue to verify and close this payment.");
      }
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
