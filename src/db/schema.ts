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
    avatarUrl: varchar("avatar_url", { length: 500 }),
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
    classificationId: int("classification_id").notNull(),
    quantityKg: decimal("quantity_kg", { precision: 12, scale: 2 }).notNull(),
    reservedKg: decimal("reserved_kg", { precision: 12, scale: 2 }).default("0").notNull(),
    updatedAt,
  },
  (table) => [
    uniqueIndex("inventory_product_classification_farmer_unique").on(
      table.productId,
      table.classificationId,
      table.farmerId,
    ),
    index("inventory_farmer_idx").on(table.farmerId, table.productId),
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
export const productionRecords = mysqlTable(
  "production_records",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    farmerId: varchar("farmer_id", { length: 36 }).notNull(),
    productId: varchar("product_id", { length: 36 }),
    cropName: varchar("crop_name", { length: 160 }).notNull(),
    plantingDate: datetime("planting_date").notNull(),
    expectedHarvestDate: datetime("expected_harvest_date").notNull(),
    harvestedQuantityKg: decimal("harvested_quantity_kg", { precision: 12, scale: 2 }),
    recordedById: varchar("recorded_by_id", { length: 36 }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [index("production_records_farmer_idx").on(table.farmerId, table.plantingDate)],
);
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
    inventoryId: varchar("inventory_id", { length: 36 }).notNull(),
    pricePerKg: decimal("price_per_kg", { precision: 12, scale: 2 }).notNull(),
    retailPricePerKg: decimal("retail_price_per_kg", { precision: 12, scale: 2 }),
    bundlePricePerKg: decimal("bundle_price_per_kg", { precision: 12, scale: 2 }),
    bundleMinimumKg: decimal("bundle_minimum_kg", { precision: 12, scale: 2 }),
    status: mysqlEnum("status", ["draft", "published", "unavailable", "archived"])
      .default("draft")
      .notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("listings_inventory_unique").on(table.inventoryId),
    index("listings_status_idx").on(table.status),
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
    contact: varchar("contact", { length: 80 }).notNull(),
    pickupNote: text("pickup_note").notNull(),
    // The delivery fee is fixed at checkout so later Management changes do not
    // alter the amount a buyer agreed to pay for an existing order.
    deliveryFee: decimal("delivery_fee", { precision: 12, scale: 2 }).default("0.00").notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    confirmedAt: datetime("confirmed_at"),
    soldAt: datetime("sold_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("orders_number_unique").on(table.orderNumber),
    index("orders_buyer_idx").on(table.buyerId),
  ],
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
    createdAt,
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
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
export const communityMessages = mysqlTable("community_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  authorId: varchar("author_id", { length: 36 }).notNull(),
  message: text("message").notNull(),
  createdAt,
  updatedAt,
});
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
export const guidanceMessages = mysqlTable("guidance_messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  farmerId: varchar("farmer_id", { length: 36 }).notNull(),
  consultantId: varchar("consultant_id", { length: 36 }).notNull(),
  authorId: varchar("author_id", { length: 36 }).notNull(),
  message: text("message").notNull(),
  createdAt,
  updatedAt,
});
export const farmerConsultantAssignments = mysqlTable(
  "farmer_consultant_assignments",
  {
    farmerId: varchar("farmer_id", { length: 36 }).primaryKey(),
    consultantId: varchar("consultant_id", { length: 36 }).notNull(),
    assignedById: varchar("assigned_by_id", { length: 36 }),
    createdAt,
    updatedAt,
  },
  (table) => [index("farmer_consultant_consultant_idx").on(table.consultantId)],
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
