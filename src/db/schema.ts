import { relations } from "drizzle-orm";
import {
  boolean,
  datetime,
  decimal,
  index,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const createdAt = timestamp("created_at").defaultNow().notNull();
const updatedAt = timestamp("updated_at").defaultNow().onUpdateNow().notNull();

export const roles = mysqlTable(
  "roles",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 50 }).notNull(),
    createdAt,
  },
  (table) => [uniqueIndex("roles_name_unique").on(table.name)],
);
export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    username: varchar("username", { length: 120 }).notNull(),
    // Buyer self-registration is username-based. Internal accounts can still retain an
    // email address for the existing email recovery flow.
    email: varchar("email", { length: 255 }),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    contact: varchar("contact", { length: 80 }),
    avatarUrl: mediumtext("avatar_url"),
    avatarVisibility: varchar("avatar_visibility", { length: 32 }).default("everyone").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("users_username_unique").on(table.username),
    uniqueIndex("users_email_unique").on(table.email),
  ],
);
export const userRoles = mysqlTable(
  "user_roles",
  {
    userId: varchar("user_id", { length: 36 }).notNull(),
    roleId: int("role_id").notNull(),
    createdAt,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index("user_roles_role_idx").on(table.roleId),
  ],
);
export const products = mysqlTable(
  "products",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    cropType: varchar("crop_type", { length: 100 }).notNull(),
    description: text("description"),
    // Product photos selected by a Marketer are stored as validated, size-limited data URLs.
    // MEDIUMTEXT leaves enough room for a compressed marketplace image.
    imageUrl: mediumtext("image_url"),
    sellingUnit: mysqlEnum("selling_unit", ["kg", "piece", "bundle", "pack", "tray", "sack"])
      .default("kg")
      .notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("products_name_unique").on(table.name)],
);
export const classifications = mysqlTable(
  "classifications",
  {
    id: int("id").autoincrement().primaryKey(),
    name: mysqlEnum("name", ["Good", "Semi", "Reject"]).notNull(),
    createdAt,
  },
  (table) => [uniqueIndex("classifications_name_unique").on(table.name)],
);
export const inventory = mysqlTable(
  "inventory",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    productId: varchar("product_id", { length: 36 }).notNull(),
    farmerId: varchar("farmer_id", { length: 36 }),
    receivingId: varchar("receiving_id", { length: 36 }),
    classificationId: int("classification_id").notNull(),
    quantityKg: decimal("quantity_kg", { precision: 12, scale: 2 }).notNull(),
    reservedKg: decimal("reserved_kg", { precision: 12, scale: 2 }).default("0").notNull(),
    receivedAt: datetime("received_at").notNull(),
    updatedAt,
  },
  (table) => [
    index("inventory_product_classification_lot_idx").on(
      table.productId,
      table.classificationId,
      table.receivedAt,
    ),
    index("inventory_farmer_idx").on(table.farmerId, table.productId),
    index("inventory_receiving_idx").on(table.receivingId),
  ],
);
export const receivingRecords = mysqlTable("receiving_records", {
  id: varchar("id", { length: 36 }).primaryKey(),
  farmerId: varchar("farmer_id", { length: 36 }).notNull(),
  recordedById: varchar("recorded_by_id", { length: 36 }).notNull(),
  productId: varchar("product_id", { length: 36 }).notNull(),
  totalKg: decimal("total_kg", { precision: 12, scale: 2 }).notNull(),
  receivedAt: datetime("received_at").notNull(),
  createdAt,
});
export const receivingClassifications = mysqlTable(
  "receiving_classifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    receivingId: varchar("receiving_id", { length: 36 }).notNull(),
    classificationId: int("classification_id").notNull(),
    quantityKg: decimal("quantity_kg", { precision: 12, scale: 2 }).notNull(),
    createdAt,
  },
  (table) => [index("receiving_classifications_receiving_idx").on(table.receivingId)],
);
export const listings = mysqlTable(
  "marketplace_listings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    // Permanent offers belong to a product + quality, not to one Farmer's stock row.
    // inventoryId remains nullable while older records are migrated.
    inventoryId: varchar("inventory_id", { length: 36 }),
    productId: varchar("product_id", { length: 36 }).notNull(),
    classificationId: int("classification_id").notNull(),
    pricePerKg: decimal("price_per_kg", { precision: 12, scale: 2 }).notNull(),
    retailPricePerKg: decimal("retail_price_per_kg", { precision: 12, scale: 2 }),
    priceConfigured: boolean("price_configured").default(false).notNull(),
    bundlePricePerKg: decimal("bundle_price_per_kg", { precision: 12, scale: 2 }),
    bundleMinimumKg: decimal("bundle_minimum_kg", { precision: 12, scale: 2 }),
    imageUrl: mediumtext("image_url"),
    status: mysqlEnum("status", ["draft", "published", "unavailable", "archived"])
      .default("draft")
      .notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("listings_product_classification_unique").on(
      table.productId,
      table.classificationId,
    ),
    index("listings_status_idx").on(table.status),
    index("listings_inventory_idx").on(table.inventoryId),
  ],
);
export const carts = mysqlTable(
  "carts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    buyerId: varchar("buyer_id", { length: 36 }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("carts_buyer_unique").on(table.buyerId)],
);
export const cartItems = mysqlTable(
  "cart_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cartId: varchar("cart_id", { length: 36 }).notNull(),
    listingId: varchar("listing_id", { length: 36 }).notNull(),
    quantityKg: decimal("quantity_kg", { precision: 12, scale: 2 }).notNull(),
    reservationExpiresAt: datetime("reservation_expires_at").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("cart_items_cart_listing_unique").on(table.cartId, table.listingId),
    index("cart_items_cart_idx").on(table.cartId),
    index("cart_items_reservation_expiry_idx").on(table.reservationExpiresAt),
  ],
);
export const orders = mysqlTable(
  "orders",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderNumber: varchar("order_number", { length: 40 }).notNull(),
    buyerId: varchar("buyer_id", { length: 36 }).notNull(),
    status: mysqlEnum("status", ["pending", "confirmed", "sold", "cancelled", "rejected"])
      .default("pending")
      .notNull(),
    fulfillmentMethod: mysqlEnum("fulfillment_method", ["pickup", "delivery"])
      .default("pickup")
      .notNull(),
    fulfillmentStatus: mysqlEnum("fulfillment_status", [
      "pending",
      "confirmed",
      "preparing",
      "ready_for_pickup",
      "ready_for_dispatch",
      "rider_assigned",
      "out_for_delivery",
      "delivery_failed",
      "rescheduled",
      "picked_up",
      "delivered",
      "cancelled",
      "rejected",
    ])
      .default("pending")
      .notNull(),
    contact: varchar("contact", { length: 80 }).notNull(),
    pickupNote: text("pickup_note").notNull(),
    recipientName: varchar("recipient_name", { length: 160 }),
    deliveryAddress: text("delivery_address"),
    preferredSchedule: varchar("preferred_schedule", { length: 255 }),
    deliveryInstructions: text("delivery_instructions"),
    assignedRiderId: varchar("assigned_rider_id", { length: 36 }),
    deliveryOtpCode: varchar("delivery_otp_code", { length: 6 }),
    farmerSettlementEligible: boolean("farmer_settlement_eligible").default(true).notNull(),
    // The delivery fee is fixed at checkout so later Management changes do not
    // alter the amount a buyer agreed to pay for an existing order.
    deliveryFee: decimal("delivery_fee", { precision: 12, scale: 2 }).default("0.00").notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    confirmedAt: datetime("confirmed_at"),
    soldAt: datetime("sold_at"),
    fulfilledAt: datetime("fulfilled_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("orders_number_unique").on(table.orderNumber),
    index("orders_buyer_idx").on(table.buyerId),
  ],
);
export const orderFulfillmentHistory = mysqlTable(
  "order_fulfillment_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "confirmed",
      "preparing",
      "ready_for_pickup",
      "ready_for_dispatch",
      "rider_assigned",
      "out_for_delivery",
      "delivery_failed",
      "rescheduled",
      "picked_up",
      "delivered",
      "cancelled",
      "rejected",
    ]).notNull(),
    changedById: varchar("changed_by_id", { length: 36 }),
    note: text("note"),
    changedAt: datetime("changed_at").notNull(),
  },
  (table) => [index("order_fulfillment_history_order_idx").on(table.orderId, table.changedAt)],
);
export const deliverySettings = mysqlTable("delivery_settings", {
  // A singleton row (id 1) keeps the delivery fee in the database instead of
  // trusting a browser-provided amount.
  id: int("id").primaryKey(),
  flatFee: decimal("flat_fee", { precision: 12, scale: 2 }).default("59.00").notNull(),
  // Management can pause delivery when no Rider is available. Checkout also
  // verifies this flag on the server, so it cannot be bypassed in the browser.
  deliveryEnabled: boolean("delivery_enabled").default(true).notNull(),
  updatedById: varchar("updated_by_id", { length: 36 }),
  createdAt,
  updatedAt,
});
export const deliveryAssignments = mysqlTable(
  "delivery_assignments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    riderId: varchar("rider_id", { length: 36 }).notNull(),
    assignedById: varchar("assigned_by_id", { length: 36 }),
    reason: text("reason"),
    assignedAt: datetime("assigned_at").notNull(),
  },
  (table) => [index("delivery_assignments_order_idx").on(table.orderId, table.assignedAt)],
);
export const deliveryAttempts = mysqlTable(
  "delivery_attempts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    riderId: varchar("rider_id", { length: 36 }).notNull(),
    outcome: mysqlEnum("outcome", [
      "delivered",
      "buyer_unavailable",
      "wrong_address",
      "refused",
      "rescheduled",
    ]).notNull(),
    reasonNote: text("reason_note"),
    recipientName: varchar("recipient_name", { length: 160 }),
    proofPhotoUrl: mediumtext("proof_photo_url"),
    signatureUrl: mediumtext("signature_url"),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    nextSchedule: varchar("next_schedule", { length: 255 }),
    attemptedAt: datetime("attempted_at").notNull(),
  },
  (table) => [index("delivery_attempts_order_idx").on(table.orderId, table.attemptedAt)],
);
export const codRemittances = mysqlTable(
  "cod_remittances",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    riderId: varchar("rider_id", { length: 36 }).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    status: mysqlEnum("status", ["collected", "submitted", "verified", "closed"])
      .default("collected")
      .notNull(),
    collectedAt: datetime("collected_at").notNull(),
    submittedAt: datetime("submitted_at"),
    verifiedAt: datetime("verified_at"),
    verifiedById: varchar("verified_by_id", { length: 36 }),
    closedAt: datetime("closed_at"),
    notes: text("notes"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("cod_remittances_order_unique").on(table.orderId),
    index("cod_remittances_status_idx").on(table.status, table.createdAt),
    index("cod_remittances_rider_idx").on(table.riderId, table.status),
  ],
);
export const deliveryDisputes = mysqlTable(
  "delivery_disputes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    disputeNumber: varchar("dispute_number", { length: 40 }).notNull(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    buyerId: varchar("buyer_id", { length: 36 }).notNull(),
    category: mysqlEnum("category", [
      "missing_quantity",
      "wrong_product",
      "damaged_product",
      "incorrect_price",
      "order_not_received",
      "other",
    ]).notNull(),
    description: text("description").notNull(),
    attachmentUrl: mediumtext("attachment_url"),
    status: mysqlEnum("status", [
      "submitted",
      "under_review",
      "waiting_response",
      "approved",
      "rejected",
      "resolved",
    ])
      .default("submitted")
      .notNull(),
    resolution: mysqlEnum("resolution", [
      "replace_product",
      "partial_refund",
      "full_refund",
      "credit_next_order",
      "no_action",
    ]),
    resolutionNote: text("resolution_note"),
    refundAmount: decimal("refund_amount", { precision: 12, scale: 2 }),
    refundStatus: mysqlEnum("refund_status", ["not_required", "pending", "processed"])
      .default("not_required")
      .notNull(),
    decidedById: varchar("decided_by_id", { length: 36 }),
    accountingProcessedById: varchar("accounting_processed_by_id", { length: 36 }),
    accountingProcessedAt: datetime("accounting_processed_at"),
    openedAt: datetime("opened_at").notNull(),
    resolvedAt: datetime("resolved_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("delivery_disputes_number_unique").on(table.disputeNumber),
    uniqueIndex("delivery_disputes_order_unique").on(table.orderId),
    index("delivery_disputes_status_idx").on(table.status, table.createdAt),
    index("delivery_disputes_buyer_idx").on(table.buyerId, table.createdAt),
    index("delivery_disputes_refund_idx").on(table.refundStatus, table.createdAt),
  ],
);
export const deliveryDisputeResponses = mysqlTable(
  "delivery_dispute_responses",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    disputeId: varchar("dispute_id", { length: 36 }).notNull(),
    authorId: varchar("author_id", { length: 36 }).notNull(),
    authorRole: varchar("author_role", { length: 40 }).notNull(),
    message: text("message").notNull(),
    createdAt,
  },
  (table) => [index("delivery_dispute_responses_case_idx").on(table.disputeId, table.createdAt)],
);
export const deliveryDisputeEvents = mysqlTable(
  "delivery_dispute_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    disputeId: varchar("dispute_id", { length: 36 }).notNull(),
    actorId: varchar("actor_id", { length: 36 }),
    event: varchar("event", { length: 80 }).notNull(),
    note: text("note"),
    createdAt,
  },
  (table) => [index("delivery_dispute_events_case_idx").on(table.disputeId, table.createdAt)],
);
export const orderStatusHistory = mysqlTable(
  "order_status_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "confirmed",
      "sold",
      "cancelled",
      "rejected",
    ]).notNull(),
    changedById: varchar("changed_by_id", { length: 36 }),
    note: text("note"),
    changedAt: datetime("changed_at").notNull(),
  },
  (table) => [index("order_status_history_order_idx").on(table.orderId, table.changedAt)],
);
export const orderItems = mysqlTable(
  "order_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    listingId: varchar("listing_id", { length: 36 }).notNull(),
    quantityKg: decimal("quantity_kg", { precision: 12, scale: 2 }).notNull(),
    pricePerKg: decimal("price_per_kg", { precision: 12, scale: 2 }).notNull(),
    productName: varchar("product_name", { length: 160 }),
    classificationName: varchar("classification_name", { length: 20 }),
    sellingUnit: mysqlEnum("selling_unit", ["kg", "piece", "bundle", "pack", "tray", "sack"])
      .default("kg")
      .notNull(),
    imageUrl: mediumtext("image_url"),
    createdAt,
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);
export const orderFeedback = mysqlTable(
  "order_feedback",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    buyerId: varchar("buyer_id", { length: 36 }).notNull(),
    serviceRating: int("service_rating").notNull(),
    riderRating: int("rider_rating"),
    comment: text("comment"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("order_feedback_order_unique").on(table.orderId),
    index("order_feedback_buyer_idx").on(table.buyerId, table.createdAt),
  ],
);
export const orderItemRatings = mysqlTable(
  "order_item_ratings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    feedbackId: varchar("feedback_id", { length: 36 }).notNull(),
    orderItemId: varchar("order_item_id", { length: 36 }).notNull(),
    productId: varchar("product_id", { length: 36 }).notNull(),
    rating: int("rating").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("order_item_ratings_order_item_unique").on(table.orderItemId),
    index("order_item_ratings_feedback_idx").on(table.feedbackId),
    index("order_item_ratings_product_idx").on(table.productId, table.createdAt),
  ],
);
export const payments = mysqlTable(
  "payments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    paymentNumber: varchar("payment_number", { length: 40 }).notNull(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    // Legacy values stay readable for existing payment records. New payments are restricted to
    // cash and cash_on_delivery by paymentInput in marketplace-server-functions.ts.
    method: mysqlEnum("method", [
      "cash",
      "cash_on_delivery",
      "bank_transfer",
      "manual_reference",
    ]).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    recordedById: varchar("recorded_by_id", { length: 36 }).notNull(),
    paidAt: datetime("paid_at").notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("payments_number_unique").on(table.paymentNumber),
    uniqueIndex("payments_order_unique").on(table.orderId),
  ],
);
export const farmerEarnings = mysqlTable(
  "farmer_earnings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    inventoryId: varchar("inventory_id", { length: 36 }).notNull(),
    receivingId: varchar("receiving_id", { length: 36 }).notNull(),
    farmerId: varchar("farmer_id", { length: 36 }).notNull(),
    productId: varchar("product_id", { length: 36 }).notNull(),
    classificationId: int("classification_id").notNull(),
    sellingUnit: mysqlEnum("selling_unit", ["kg", "piece", "bundle", "pack", "tray", "sack"])
      .default("kg")
      .notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
    pricePerUnit: decimal("price_per_unit", { precision: 12, scale: 2 }).notNull(),
    grossAmount: decimal("gross_amount", { precision: 12, scale: 2 }).notNull(),
    serviceFee: decimal("service_fee", { precision: 12, scale: 2 }).notNull(),
    iponContribution: decimal("ipon_contribution", { precision: 12, scale: 2 }).notNull(),
    netAmount: decimal("net_amount", { precision: 12, scale: 2 }).notNull(),
    status: mysqlEnum("status", ["pending_payment", "available", "paid"])
      .default("pending_payment")
      .notNull(),
    payoutId: varchar("payout_id", { length: 36 }),
    iponReleaseId: varchar("ipon_release_id", { length: 36 }),
    eligibleAt: datetime("eligible_at"),
    paidAt: datetime("paid_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("farmer_earnings_order_inventory_unique").on(table.orderId, table.inventoryId),
    index("farmer_earnings_farmer_status_idx").on(table.farmerId, table.status, table.createdAt),
    index("farmer_earnings_receiving_idx").on(table.receivingId, table.status),
    index("farmer_earnings_ipon_idx").on(table.farmerId, table.iponReleaseId, table.status),
  ],
);
export const farmerPayouts = mysqlTable(
  "farmer_payouts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    payoutNumber: varchar("payout_number", { length: 40 }).notNull(),
    farmerId: varchar("farmer_id", { length: 36 }).notNull(),
    receivingId: varchar("receiving_id", { length: 36 }).notNull(),
    grossAmount: decimal("gross_amount", { precision: 12, scale: 2 }).notNull(),
    serviceFee: decimal("service_fee", { precision: 12, scale: 2 }).notNull(),
    iponContribution: decimal("ipon_contribution", { precision: 12, scale: 2 }).notNull(),
    netAmount: decimal("net_amount", { precision: 12, scale: 2 }).notNull(),
    method: mysqlEnum("method", ["cash"]).default("cash").notNull(),
    releasedById: varchar("released_by_id", { length: 36 }).notNull(),
    releasedAt: datetime("released_at").notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("farmer_payouts_number_unique").on(table.payoutNumber),
    index("farmer_payouts_farmer_idx").on(table.farmerId, table.releasedAt),
    index("farmer_payouts_receiving_idx").on(table.receivingId, table.releasedAt),
  ],
);
export const farmerIponReleases = mysqlTable(
  "farmer_ipon_releases",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    releaseNumber: varchar("release_number", { length: 40 }).notNull(),
    farmerId: varchar("farmer_id", { length: 36 }).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    method: mysqlEnum("method", ["cash"]).default("cash").notNull(),
    releasedById: varchar("released_by_id", { length: 36 }).notNull(),
    releasedAt: datetime("released_at").notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("farmer_ipon_releases_number_unique").on(table.releaseNumber),
    index("farmer_ipon_releases_farmer_idx").on(table.farmerId, table.releasedAt),
  ],
);
export const inventoryMovements = mysqlTable(
  "inventory_movements",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    inventoryId: varchar("inventory_id", { length: 36 }).notNull(),
    movementType: mysqlEnum("movement_type", [
      "receiving",
      "reservation",
      "release",
      "sale",
      "adjustment",
      "return",
    ]).notNull(),
    availableChangeKg: decimal("available_change_kg", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    reservedChangeKg: decimal("reserved_change_kg", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    referenceType: varchar("reference_type", { length: 50 }),
    referenceId: varchar("reference_id", { length: 36 }),
    recordedById: varchar("recorded_by_id", { length: 36 }),
    note: text("note"),
    createdAt,
  },
  (table) => [index("inventory_movements_inventory_idx").on(table.inventoryId, table.createdAt)],
);
export const dailyPrices = mysqlTable(
  "daily_prices",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    listingId: varchar("listing_id", { length: 36 }).notNull(),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    priceDate: datetime("price_date").notNull(),
    published: boolean("published").default(false).notNull(),
    createdById: varchar("created_by_id", { length: 36 }).notNull(),
    createdAt,
  },
  (table) => [index("daily_prices_listing_date_idx").on(table.listingId, table.priceDate)],
);
export const dailyPriceAlerts = mysqlTable(
  "daily_price_alerts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    buyerId: varchar("buyer_id", { length: 36 }).notNull(),
    listingId: varchar("listing_id", { length: 36 }).notNull(),
    targetPrice: decimal("target_price", { precision: 12, scale: 2 }).notNull(),
    active: boolean("active").default(true).notNull(),
    lastNotifiedAt: datetime("last_notified_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("daily_price_alerts_buyer_listing_unique").on(table.buyerId, table.listingId),
    index("daily_price_alerts_listing_active_idx").on(table.listingId, table.active),
  ],
);
export const communityMessages = mysqlTable(
  "community_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    authorId: varchar("author_id", { length: 36 }).notNull(),
    category: mysqlEnum("category", [
      "announcement",
      "question",
      "farming_tip",
      "marketplace_update",
      "general_discussion",
    ])
      .default("general_discussion")
      .notNull(),
    isPinned: boolean("is_pinned").default(false).notNull(),
    pinnedAt: datetime("pinned_at"),
    pinnedById: varchar("pinned_by_id", { length: 36 }),
    questionStatus: mysqlEnum("question_status", ["open", "answered", "resolved"])
      .default("open")
      .notNull(),
    helpfulCommentId: varchar("helpful_comment_id", { length: 36 }),
    moderationStatus: mysqlEnum("moderation_status", ["visible", "hidden"])
      .default("visible")
      .notNull(),
    moderatedAt: datetime("moderated_at"),
    moderatedById: varchar("moderated_by_id", { length: 36 }),
    moderationReason: varchar("moderation_reason", { length: 500 }),
    message: text("message").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("community_messages_category_created_idx").on(table.category, table.createdAt),
    index("community_messages_pinned_created_idx").on(
      table.isPinned,
      table.pinnedAt,
      table.createdAt,
    ),
  ],
);
export const communityAttachments = mysqlTable(
  "community_attachments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("message_id", { length: 36 }).notNull(),
    imageUrl: mediumtext("image_url").notNull(),
    position: int("position").default(0).notNull(),
    createdAt,
  },
  (table) => [
    index("community_attachments_message_position_idx").on(table.messageId, table.position),
  ],
);
export const communityBookmarks = mysqlTable(
  "community_bookmarks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("message_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("community_bookmarks_message_user_unique").on(table.messageId, table.userId),
    index("community_bookmarks_user_created_idx").on(table.userId, table.createdAt),
  ],
);
export const communityReports = mysqlTable(
  "community_reports",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("message_id", { length: 36 }).notNull(),
    reporterId: varchar("reporter_id", { length: 36 }).notNull(),
    reason: varchar("reason", { length: 500 }).notNull(),
    status: mysqlEnum("status", ["pending", "reviewed", "dismissed", "removed"])
      .default("pending")
      .notNull(),
    reviewedById: varchar("reviewed_by_id", { length: 36 }),
    reviewedAt: datetime("reviewed_at"),
    createdAt,
  },
  (table) => [
    uniqueIndex("community_reports_message_reporter_unique").on(table.messageId, table.reporterId),
    index("community_reports_status_created_idx").on(table.status, table.createdAt),
  ],
);
export const communityReactions = mysqlTable(
  "community_reactions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("message_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    reaction: mysqlEnum("reaction", ["like", "dislike"]).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("community_reactions_message_user_unique").on(table.messageId, table.userId),
    index("community_reactions_message_idx").on(table.messageId),
    index("community_reactions_user_idx").on(table.userId),
  ],
);
export const communityComments = mysqlTable(
  "community_comments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("message_id", { length: 36 }).notNull(),
    parentCommentId: varchar("parent_comment_id", { length: 36 }),
    authorId: varchar("author_id", { length: 36 }).notNull(),
    message: text("message").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("community_comments_message_created_idx").on(table.messageId, table.createdAt),
    index("community_comments_parent_created_idx").on(table.parentCommentId, table.createdAt),
    index("community_comments_author_idx").on(table.authorId),
  ],
);
export const communityCommentReactions = mysqlTable(
  "community_comment_reactions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    commentId: varchar("comment_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    reaction: mysqlEnum("reaction", ["like", "dislike"]).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("community_comment_reactions_comment_user_unique").on(
      table.commentId,
      table.userId,
    ),
    index("community_comment_reactions_comment_idx").on(table.commentId),
    index("community_comment_reactions_user_idx").on(table.userId),
  ],
);
export const directMessages = mysqlTable(
  "direct_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    senderId: varchar("sender_id", { length: 36 }).notNull(),
    recipientId: varchar("recipient_id", { length: 36 }).notNull(),
    message: text("message").notNull(),
    readAt: datetime("read_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("direct_messages_sender_recipient_created_idx").on(
      table.senderId,
      table.recipientId,
      table.createdAt,
    ),
    index("direct_messages_recipient_read_idx").on(table.recipientId, table.readAt),
  ],
);
export const farmerAiConversations = mysqlTable(
  "farmer_ai_conversations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    farmerId: varchar("farmer_id", { length: 36 }).notNull(),
    cropName: varchar("crop_name", { length: 160 }).notNull(),
    // Kept as YYYY-MM-DD so the farmer can leave the planting date blank without
    // timezone conversion changing the selected day.
    plantingDate: varchar("planting_date", { length: 10 }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("farmer_ai_conversations_farmer_updated_idx").on(table.farmerId, table.updatedAt),
  ],
);
export const farmerAiMessages = mysqlTable(
  "farmer_ai_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    conversationId: varchar("conversation_id", { length: 36 }).notNull(),
    sender: mysqlEnum("sender", ["farmer", "assistant"]).notNull(),
    message: text("message").notNull(),
    createdAt,
  },
  (table) => [
    index("farmer_ai_messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  ],
);
export const notifications = mysqlTable(
  "notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    target: varchar("target", { length: 500 }),
    readAt: datetime("read_at"),
    createdAt,
  },
  (table) => [index("notifications_user_read_idx").on(table.userId, table.readAt)],
);
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    actorId: varchar("actor_id", { length: 36 }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: varchar("entity_id", { length: 36 }),
    details: json("details"),
    createdAt,
  },
  (table) => [index("audit_logs_entity_idx").on(table.entityType, table.entityId)],
);
export const authSessions = mysqlTable(
  "auth_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: datetime("expires_at").notNull(),
    revokedAt: datetime("revoked_at"),
    createdAt,
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
    index("auth_sessions_user_idx").on(table.userId),
  ],
);
export const passwordResetTokens = mysqlTable(
  "password_reset_tokens",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: datetime("expires_at").notNull(),
    usedAt: datetime("used_at"),
    createdAt,
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_idx").on(table.userId),
  ],
);
export const securityRateLimits = mysqlTable(
  "security_rate_limits",
  {
    scope: varchar("scope", { length: 64 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    attempts: int("attempts").notNull(),
    windowStartedAt: datetime("window_started_at").notNull(),
    lockedUntil: datetime("locked_until"),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.keyHash] }),
    index("security_rate_limits_window_idx").on(table.windowStartedAt),
  ],
);
export const savedDrafts = mysqlTable(
  "saved_drafts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    draftType: varchar("draft_type", { length: 80 }).notNull(),
    content: json("content").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [index("saved_drafts_user_idx").on(table.userId, table.draftType)],
);

export const usersRelations = relations(users, ({ many }) => ({ userRoles: many(userRoles) }));
export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));
