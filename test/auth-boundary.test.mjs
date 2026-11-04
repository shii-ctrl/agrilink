import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("buyer registration response is an explicit safe DTO", async () => {
  const source = await readFile("src/services/auth/auth-functions.ts", "utf8");
  const registration = source.slice(source.indexOf("export const registerBuyer"));
  assert.match(registration, /return \{\s*id: user\.id,/);
  assert.doesNotMatch(registration, /return \{ \.\.\.user/);
});

test("Buyer self-registration is username-only and keeps email optional", async () => {
  const [authFunctions, schema, migration, registerPage, registerDialog, homePage] =
    await Promise.all([
      readFile("src/services/auth/auth-functions.ts", "utf8"),
      readFile("src/db/schema.ts", "utf8"),
      readFile("drizzle/0012_make_buyer_email_optional.sql", "utf8"),
      readFile("src/routes/register.tsx", "utf8"),
      readFile("src/features/auth/components/register-dialog.tsx", "utf8"),
      readFile("src/routes/index.tsx", "utf8"),
    ]);

  const registration = authFunctions.slice(
    authFunctions.indexOf("const registrationInput"),
    authFunctions.indexOf("const profileImage"),
  );
  assert.match(registration, /username: z/);
  assert.match(authFunctions, /email: null,/);
  assert.doesNotMatch(registration, /contact: z\.string\(\)\.trim\(\)\.min\(5\)/);
  assert.match(schema, /email: varchar\("email", \{ length: 255 \}\),/);
  assert.match(migration, /ALTER TABLE users MODIFY email VARCHAR\(255\) NULL/);
  assert.match(registerPage, /redirect\(\{ to: "\/", search: \{ auth: "register" \} \}\)/);
  assert.match(registerDialog, /name="username"/);
  assert.doesNotMatch(registerDialog, /name="contact"/);
  assert.doesNotMatch(registerDialog, /name="email"/);
  assert.match(registerDialog, /Create a Buyer account/);
  assert.match(registerDialog, /Username-only Buyer accounts do not have email password recovery/);
  assert.match(homePage, /RegisterDialog/);
});

test("initial Management setup is guarded by a server-side one-time secret", async () => {
  const source = await readFile("src/services/auth/admin-server-functions.ts", "utf8");
  const setup = source.slice(source.indexOf("export const createInitialManagementAccount"));
  assert.match(setup, /INITIAL_MANAGEMENT_SETUP_SECRET/);
  assert.match(setup, /timingSafeEqual/);
  assert.match(setup, /FOR UPDATE/);
  assert.match(setup, /A Management account already exists/);
  assert.doesNotMatch(setup, /return \{[^}]*passwordHash/);
});

test("password changes require authentication and hash the new password", async () => {
  const source = await readFile("src/services/auth/auth-functions.ts", "utf8");
  const changePassword = source.slice(source.indexOf("export const changeCurrentPassword"));
  assert.match(changePassword, /requireUser/);
  assert.match(changePassword, /bcrypt\.compare\(data\.currentPassword/);
  assert.match(changePassword, /bcrypt\.hash\(data\.newPassword, 12\)/);
  assert.match(changePassword, /update\(authSessions\)\s*\.set\(\{ revokedAt: now \}\)/);
  assert.match(changePassword, /createSession\(user\.id\)/);
  assert.match(changePassword, /auth\.password\.change/);
  assert.doesNotMatch(changePassword, /return \{[^}]*passwordHash/);
});

test("Management password resets are authenticated and audited", async () => {
  const source = await readFile("src/services/auth/admin-server-functions.ts", "utf8");
  const resetPassword = source.slice(source.indexOf("export const resetManagedUserPassword"));
  assert.match(resetPassword, /requireRole\("Management"\)/);
  assert.match(resetPassword, /bcrypt\.hash\(data\.password, 12\)/);
  assert.match(resetPassword, /update\(authSessions\)\s*\.set\(\{ revokedAt: now \}\)/);
  assert.match(resetPassword, /user\.password\.reset/);
  assert.doesNotMatch(resetPassword, /return \{[^}]*passwordHash/);
});

test("new and reset account passwords require the stronger shared password policy", async () => {
  const [authSource, adminSource, registrationDialog, setupPage] = await Promise.all([
    readFile("src/services/auth/auth-functions.ts", "utf8"),
    readFile("src/services/auth/admin-server-functions.ts", "utf8"),
    readFile("src/features/auth/components/register-dialog.tsx", "utf8"),
    readFile("src/routes/setup-management.tsx", "utf8"),
  ]);

  assert.match(authSource, /securePassword/);
  assert.match(adminSource, /securePassword/);
  assert.doesNotMatch(
    authSource,
    /Include an uppercase letter|Include a lowercase letter|Include a number/,
  );
  assert.doesNotMatch(
    adminSource,
    /Include an uppercase letter|Include a lowercase letter|Include a number/,
  );
  assert.match(registrationDialog, /minLength=\{minimumPasswordLength\}/);
  assert.match(setupPage, /minLength=\{minimumPasswordLength\}/);
});

test("email password reset uses a hashed, expiring one-time code", async () => {
  const [source, resetDialog] = await Promise.all([
    readFile("src/services/auth/auth-functions.ts", "utf8"),
    readFile("src/features/auth/components/password-reset-dialog.tsx", "utf8"),
  ]);
  const requestReset = source.slice(
    source.indexOf("export const requestPasswordResetCode"),
    source.indexOf("export const completePasswordReset"),
  );
  const completeReset = source.slice(source.indexOf("export const completePasswordReset"));

  assert.match(requestReset, /crypto\.randomInt\(0, 1_000_000\)/);
  assert.match(requestReset, /hashPasswordResetCode\(code\)/);
  assert.match(requestReset, /expiresAt/);
  assert.match(requestReset, /sendPasswordResetCode/);
  assert.doesNotMatch(requestReset, /return \{[^}]*code/);
  assert.match(completeReset, /isNull\(passwordResetTokens\.usedAt\)/);
  assert.match(completeReset, /\.update\(passwordResetTokens\)\s*\.set\(\{ usedAt: now \}\)/);
  assert.match(completeReset, /\.update\(authSessions\)\s*\.set\(\{ revokedAt: now \}\)/);
  assert.match(completeReset, /auth\.password\.reset\.email_otp/);
  assert.match(resetDialog, /value=\{code\}/);
  assert.match(resetDialog, /type="text"/);
  assert.match(resetDialog, /autoComplete="one-time-code"/);
  assert.match(resetDialog, /replace\(\/\\D\/g, ""\)\.slice\(0, 6\)/);
});

test("authentication abuse controls persist beyond a single server process", async () => {
  const [authServer, authFunctions, admin, schema, migration] = await Promise.all([
    readFile("src/services/auth/auth-server.ts", "utf8"),
    readFile("src/services/auth/auth-functions.ts", "utf8"),
    readFile("src/services/auth/admin-server-functions.ts", "utf8"),
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0008_security_rate_limits.sql", "utf8"),
  ]);

  assert.match(authServer, /export async function consumeRateLimit/);
  assert.match(authServer, /FOR UPDATE/);
  assert.match(
    authServer,
    /windowStartedAt, new Date\(now\.getTime\(\) - 24 \* 60 \* 60 \* 1000\)/,
  );
  assert.doesNotMatch(authServer, /const loginAttempts = new Map/);
  assert.match(authFunctions, /password-reset-request-email/);
  assert.match(authFunctions, /password-reset-verify/);
  assert.match(authFunctions, /buyer-registration/);
  assert.match(authServer, /login-source/);
  assert.match(admin, /initial-management-setup/);
  assert.match(schema, /export const securityRateLimits/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS security_rate_limits/);
});

test("public login errors never expose database queries", async () => {
  const loginDialog = await readFile("src/features/auth/components/login-dialog.tsx", "utf8");

  assert.match(loginDialog, /function safeLoginError/);
  assert.match(loginDialog, /Sign-in is temporarily unavailable/);
  assert.match(loginDialog, /id: "login-error"/);
  assert.doesNotMatch(loginDialog, /description:\s*error instanceof Error\s*\?\s*error\.message/);
});

test("production responses set browser security headers", async () => {
  const server = await readFile("src/server.ts", "utf8");

  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /Strict-Transport-Security/);
  assert.match(server, /X-Frame-Options/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /Referrer-Policy/);
  assert.match(server, /camera=\(self\)/);
  assert.match(server, /Cache-Control/, "HTML account pages should not be cached");
});

test("profile photos accept secure external URLs or cropped local uploads and Management controls are audited", async () => {
  const [
    authFunctions,
    adminFunctions,
    schema,
    migration,
    privacyMigration,
    profile,
    avatar,
    siteHeader,
  ] = await Promise.all([
    readFile("src/services/auth/auth-functions.ts", "utf8"),
    readFile("src/services/auth/admin-server-functions.ts", "utf8"),
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0009_user_profile_photos.sql", "utf8"),
    readFile("drizzle/0025_profile_photo_privacy.sql", "utf8"),
    readFile("src/features/auth/components/live-profile.tsx", "utf8"),
    readFile("src/components/profile-avatar.tsx", "utf8"),
    readFile("src/components/layout/site-header.tsx", "utf8"),
  ]);

  assert.match(authFunctions, /const profileImage/);
  assert.match(authFunctions, /protocol === "https:"/);
  assert.match(authFunctions, /data:image\\\/jpeg;base64/);
  assert.match(authFunctions, /avatarUrl: profileImage\.nullable\(\)/);
  assert.match(schema, /avatarUrl: mediumtext\("avatar_url"\)/);
  assert.match(migration, /ADD COLUMN avatar_url/);
  assert.match(privacyMigration, /ADD COLUMN avatar_visibility/);
  assert.match(authFunctions, /Profile photo must be 200 KB or smaller/);
  assert.match(authFunctions, /avatarVisibility/);
  assert.match(authFunctions, /z\.enum\(\["everyone", "hidden"\]\)/);
  assert.match(profile, /Crop your profile photo/);
  assert.match(profile, /onPointerMove={moveCrop}/);
  assert.match(profile, /Rotate left/);
  assert.match(profile, /Apply crop/);
  assert.match(profile, /maximumSavedAvatarBytes = 200 \* 1024/);
  assert.match(profile, /canvas\.toDataURL\("image\/jpeg", quality\)/);
  assert.match(profile, /capture="user"/);
  assert.match(profile, /Who can see your profile photo/);
  assert.match(profile, /open={passwordOpen}/);
  assert.match(profile, /onClick=\{\(\) => setPasswordOpen\(true\)\}/);
  assert.match(profile, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(profile, /changingPassword \? "Changing…" : "Change password"/);
  assert.doesNotMatch(profile, /Signed-in AgriLink members|Community and private messages only/);
  assert.match(avatar, /onLoadingStatusChange/);
  assert.match(avatar, /profile photo enlarged/);
  assert.match(siteHeader, /avatarUrl: string \| null/);
  assert.match(siteHeader, /<ProfileAvatar/);
  assert.match(siteHeader, /agrilink:profile-updated/);
  assert.match(adminFunctions, /export const setManagedUserActive/);
  assert.match(adminFunctions, /Keep at least one active Management account/);
  assert.match(adminFunctions, /user\.deactivate/);
  assert.match(adminFunctions, /export const getManagementAuditLogs/);
  assert.match(adminFunctions, /export const removeManagedUserAvatar/);
  assert.match(adminFunctions, /user\.avatar\.remove/);
});

test("profile completion is limited to Farmer and Buyer accounts", async () => {
  const [profile, farmer, buyer, management, marketer, accounting, rider] = await Promise.all([
    readFile("src/features/auth/components/live-profile.tsx", "utf8"),
    readFile("src/routes/farmer.profile.tsx", "utf8"),
    readFile("src/routes/buyer.profile.tsx", "utf8"),
    readFile("src/routes/management.profile.tsx", "utf8"),
    readFile("src/routes/marketer.profile.tsx", "utf8"),
    readFile("src/routes/accounting.profile.tsx", "utf8"),
    readFile("src/routes/rider.profile.tsx", "utf8"),
  ]);

  assert.match(profile, /Profile completion/);
  assert.match(profile, /role="progressbar"/);
  assert.match(farmer, /showProfileCompletion/);
  assert.match(buyer, /showProfileCompletion/);
  for (const otherRoleProfile of [management, marketer, accounting, rider]) {
    assert.doesNotMatch(otherRoleProfile, /showProfileCompletion/);
  }
});

test("marketplace browsing keeps the public layout with Buyer mobile shopping tools", async () => {
  const [marketplace, productDetail, buyerLayout, siteHeader, floatingCart] = await Promise.all([
    readFile("src/routes/marketplace.index.tsx", "utf8"),
    readFile("src/routes/marketplace.$productId.tsx", "utf8"),
    readFile("src/components/workspaces/buyer-layout.tsx", "utf8"),
    readFile("src/components/layout/site-header.tsx", "utf8"),
    readFile("src/features/marketplace/components/floating-buyer-cart-summary.tsx", "utf8"),
  ]);

  for (const page of [marketplace, productDetail]) {
    assert.doesNotMatch(page, /<BuyerLayout>/);
    assert.doesNotMatch(page, /<BuyerPageHeader/);
    assert.match(page, /<SiteHeader/);
    assert.match(page, /<SiteFooter/);
  }
  assert.doesNotMatch(buyerLayout, /pathname\.startsWith\("\/marketplace"\)/);
  assert.match(buyerLayout, /Buyer mobile navigation/);
  assert.match(buyerLayout, /fixed inset-x-0 bottom-0/);
  assert.match(buyerLayout, /md:hidden/);
  assert.match(marketplace, /overflow-x-auto/);
  assert.match(marketplace, /<FloatingBuyerCartSummary/);
  assert.match(siteHeader, /Back to Buyer dashboard/);
  assert.match(siteHeader, /<NotificationCenter role="Buyer"/);
  assert.match(siteHeader, /compact onSignOut/);
  assert.match(floatingCart, /Current cart subtotal/);
  assert.match(floatingCart, /buyerCartChangedEvent/);
  assert.match(productDetail, /Selected subtotal/);
  assert.match(productDetail, /fixed inset-x-0 bottom-0/);
  assert.match(productDetail, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/);
});

test("mobile marketplace supports remembered grid and list views", async () => {
  const [marketplace, productCard] = await Promise.all([
    readFile("src/routes/marketplace.index.tsx", "utf8"),
    readFile("src/features/marketplace/components/product-card.tsx", "utf8"),
  ]);

  assert.match(marketplace, /type MobileCatalogView = "grid" \| "list"/);
  assert.match(marketplace, /agrilink-marketplace-mobile-view/);
  assert.match(marketplace, /aria-label="Marketplace view"/);
  assert.match(marketplace, /aria-pressed=\{active\}/);
  assert.match(marketplace, /mobileView === "grid" \? "grid-cols-2" : "grid-cols-1"/);
  assert.match(productCard, /mobileView\?: "grid" \| "list"/);
  assert.match(productCard, /mobileView === "list"/);
  assert.match(productCard, /sm:aspect-\[4\/3\] sm:w-full/);
});

test("marketplace cart controls prevent duplicate additions beyond available stock", async () => {
  const source = await readFile("src/routes/marketplace.$productId.tsx", "utf8");
  assert.match(source, /const \[isAdding, setIsAdding\] = useState\(false\)/);
  assert.match(source, /function handleBuyNow\(\)/);
  assert.match(source, /router\.navigate\(\{ to: "\/buyer\/cart" \}\)/);
  assert.match(source, /Buy now/);
  assert.match(source, /getBuyerCart\(\)/);
  assert.match(source, /remainingCartableQuantity/);
  assert.match(source, /Reserved in your cart/);
  assert.match(source, /View reserved item in cart/);
  assert.match(source, /to="\/buyer\/cart"/);
});

test("buyer cart reservations expire after ten minutes and return stock", async () => {
  const [marketplace, cartPage, schema, migration] = await Promise.all([
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/routes/buyer.cart.tsx", "utf8"),
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0018_cart_reservation_expiry.sql", "utf8"),
  ]);

  assert.match(schema, /reservationExpiresAt: datetime\("reservation_expires_at"\)\.notNull\(\)/);
  assert.match(migration, /reservation_expires_at/);
  assert.match(marketplace, /CART_RESERVATION_MINUTES = 10/);
  assert.match(marketplace, /expireBuyerCartReservations/);
  assert.match(marketplace, /expireAllBuyerCartReservations/);
  assert.match(marketplace, /Cart reservation expired after 10 minutes/);
  assert.match(marketplace, /reservationExpiresAt: nextCartReservationExpiry\(\)/);
  assert.match(cartPage, /Reserved for/);
  assert.match(cartPage, /Your cart reservation expired/);
});

test("Accounting prints buyer payment receipts after payment is recorded", async () => {
  const [buyerOrders, accountingPayments] = await Promise.all([
    readFile("src/routes/buyer.orders.tsx", "utf8"),
    readFile("src/routes/accounting.payments.tsx", "utf8"),
  ]);
  assert.doesNotMatch(buyerOrders, /Print receipt/);
  assert.match(accountingPayments, /function AccountingPaymentReceipt/);
  assert.match(accountingPayments, /recordedPayments/);
  assert.match(accountingPayments, /Print receipt/);
  assert.match(accountingPayments, /Fulfillment/);
  assert.match(accountingPayments, /Payment method/);
  assert.match(accountingPayments, /window\.print\(\)/);
});

test("order details use a responsive real-workflow stepper and clear summaries", async () => {
  const source = await readFile("src/features/marketplace/components/order-details.tsx", "utf8");

  assert.match(source, /const isDelivery = order\.fulfillmentMethod === "delivery"/);
  assert.match(source, /\["ready_for_pickup", "Ready for pickup"\]/);
  assert.match(source, /\["rider_assigned", "Rider assigned"\]/);
  assert.match(source, /\["out_for_delivery", "Out for delivery"\]/);
  assert.match(source, /\["delivered", "Delivered"\]/);
  assert.match(source, /const currentStep =/);
  assert.match(source, /aria-label="Order status steps"/);
  assert.match(source, /aria-current=\{current \? "step"/);
  assert.match(source, /<Check className="size-4"/);
  assert.match(source, /absolute left-1\/2 top-4 h-0\.5 w-full/);
  assert.match(source, /space-y-0 sm:hidden/);
  assert.match(source, /hidden px-2 pt-1 sm:flex/);
  assert.match(source, /Current ·/);
  assert.match(source, /reached \? "Completed" : "Waiting"/);
  assert.match(source, /Order fulfilled — awaiting payment recording/);
  assert.match(source, /Awaiting payment recording/);
  assert.match(source, /marketplaceImageFor\(item\.name\)/);
  assert.match(source, /item\.quantityKg \* item\.pricePerKg/);
  assert.match(source, /formatOrderDate\(entry\.changedAt, true\)/);
  assert.match(source, /timeZone: "Asia\/Manila"/);
  assert.match(source, /mx-auto max-w-5xl/);
});

test("catalog photos use a safe file picker and bundle prices are enforced at checkout", async () => {
  const [marketplace, productPage, productCard, marketerPage, imageFallback, schema, migration] =
    await Promise.all([
      readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
      readFile("src/routes/marketplace.$productId.tsx", "utf8"),
      readFile("src/features/marketplace/components/product-card.tsx", "utf8"),
      readFile("src/routes/marketer.products.tsx", "utf8"),
      readFile("src/features/marketplace/marketplace-images.ts", "utf8"),
      readFile("src/db/schema.ts", "utf8"),
      readFile("drizzle/0010_product_photos_and_bundle_pricing.sql", "utf8"),
    ]);

  assert.match(marketerPage, /type="file"/);
  assert.match(marketerPage, /prepareProductImage/);
  assert.doesNotMatch(
    marketerPage,
    /onChange=\{\(event\) => onChange\("retailPricePerKg"[\s\S]{0,160}required/,
  );
  assert.match(marketerPage, /optionalNumber\(draft\?\.retailPricePerKg/);
  assert.match(imageFallback, /product-no-image\.jpg/);
  assert.match(imageFallback, /return noProductImage/);
  assert.doesNotMatch(marketerPage, /catalog-image-url/);
  assert.match(marketplace, /imageDataUrl/);
  assert.match(marketplace, /assertSafeProductImage/);
  assert.match(marketplace, /hasImageSignature/);
  assert.match(marketplace, /Bundle price must be lower than the retail price/);
  assert.match(marketplace, /priceConfigured = offer\.retailPricePerKg !== null/);
  assert.match(marketplace, /!listing\.priceConfigured/);
  assert.match(marketplace, /export const updateMarketplaceListingPricing/);
  assert.match(marketplace, /listingUnitPrice\(row, item\.quantityKg\)/);
  assert.match(productPage, /Bundle deal/);
  assert.match(productPage, /peso\(selectedOffer\.bundlePricePerKg\)/);
  assert.match(productPage, /bundleSavingsPerUnit/);
  assert.match(productPage, /selectedOffer\.classification/);
  assert.match(productPage, /selectedOffer\.image \|\| product\.image/);
  assert.match(productCard, /translateX\(-\$\{activeImage \* 100\}%\)/);
  assert.match(productCard, /onMouseEnter=\{\(\) => setPreviewing\(true\)\}/);
  assert.match(productCard, /prefers-reduced-motion: reduce/);
  assert.match(productCard, /Opening product…/);
  assert.match(productCard, /aria-busy=\{isOpening\}/);
  assert.match(productCard, /preload="intent"/);
  assert.match(productCard, /createPortal/);
  assert.match(productCard, /fixed inset-0 z-\[100\]/);
  assert.match(productCard, /document\.body\.style\.overflow = "hidden"/);
  assert.match(productCard, /ClassificationBadge value=\{activeSlide\.classification\}/);
  assert.match(productCard, /outOfStock \? "No stock"/);
  assert.doesNotMatch(productCard, /offers\.map\(\(offer\) => \(\s*<ClassificationBadge/);
  assert.match(schema, /bundlePricePerKg: decimal\("bundle_price_per_kg"/);
  assert.match(migration, /MODIFY COLUMN image_url MEDIUMTEXT/);
});

test("catalog product descriptions may be left blank", async () => {
  const marketplace = await readFile(
    "src/services/marketplace/marketplace-server-functions.ts",
    "utf8",
  );

  assert.match(marketplace, /value\.length === 0 \|\| value\.length >= 4/);
  assert.match(marketplace, /Description must contain at least 4 characters when provided/);
});

test("daily prices use PROCY market categories as an organizing guide", async () => {
  const [categories, publicPrices, marketerPrices] = await Promise.all([
    readFile("src/features/marketplace/procy-market-categories.ts", "utf8"),
    readFile("src/routes/daily-prices.tsx", "utf8"),
    readFile("src/routes/marketer.daily-prices.tsx", "utf8"),
  ]);

  for (const category of [
    "Lowland Crops",
    "Highland Crops",
    "Fruits",
    "Root Crops",
    "Staple Crops",
    "Other Commodities",
  ]) {
    assert.match(categories, new RegExp(category));
  }
  assert.match(publicPrices, /PROCY market category/);
  assert.match(publicPrices, /Filter daily prices by PROCY market category/);
  assert.match(marketerPrices, /PROCY market categories are a guide/);
  assert.doesNotMatch(categories, /70\/60|250\/230/);
});

test("public daily prices require an active, combined in-stock listing for every quality", async () => {
  const marketplace = await readFile(
    "src/services/marketplace/marketplace-server-functions.ts",
    "utf8",
  );

  assert.match(marketplace, /eq\(dailyPrices\.published, true\)/);
  assert.match(marketplace, /eq\(listings\.status, "published"\)/);
  assert.match(marketplace, /SUM\(stock\.quantity_kg - stock\.reserved_kg\)/);
  assert.match(marketplace, /stock\.product_id = \$\{listings\.productId\}/);
  assert.match(marketplace, /stock\.classification_id = \$\{listings\.classificationId\}/);
  assert.doesNotMatch(marketplace, /classifications\.name\} <> 'Reject'/);
});

test("public daily prices provide responsive discovery, details, history, and Buyer alerts", async () => {
  const [page, marketplace, schema, migration] = await Promise.all([
    readFile("src/routes/daily-prices.tsx", "utf8"),
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0038_daily_price_alerts.sql", "utf8"),
  ]);

  assert.doesNotMatch(page, /Invalid Date/);
  assert.match(page, /Latest available prices/);
  assert.match(page, /Available products only/);
  assert.match(page, /PriceMobileCard/);
  assert.match(page, /View in marketplace/);
  assert.match(page, /3 months/);
  assert.match(page, /Set alert/);
  assert.match(marketplace, /export const saveDailyPriceAlert/);
  assert.match(marketplace, /requireRole\("Buyer"\)/);
  assert.match(marketplace, /notifyMatchingDailyPriceAlerts/);
  assert.match(schema, /dailyPriceAlerts/);
  assert.match(migration, /CREATE TABLE daily_price_alerts/);
  assert.match(migration, /daily_price_alerts_buyer_listing_unique/);
});

test("marketplace publishing protects combined stock and supports every quality in older carts", async () => {
  const marketplace = await readFile(
    "src/services/marketplace/marketplace-server-functions.ts",
    "utf8",
  );

  assert.doesNotMatch(marketplace, /Reject stock is kept internally and cannot be shown to buyers/);
  assert.doesNotMatch(
    marketplace,
    /Reject stock is kept internally and cannot be ordered by buyers/,
  );
  assert.match(marketplace, /Number\(stock\.quantityKg\) - Number\(stock\.reservedKg\) <= 0/);
  assert.match(marketplace, /reserveListingStock\(tx, \{/);
  assert.match(marketplace, /controllerListing\.status !== "published"/);
});

test("role workspaces refresh saved operational data while users are active", async () => {
  const [
    hook,
    buyerCart,
    buyerOrders,
    farmerReceiving,
    managementProducts,
    accountingPayments,
    marketplace,
  ] = await Promise.all([
    readFile("src/hooks/use-auto-refresh.ts", "utf8"),
    readFile("src/routes/buyer.cart.tsx", "utf8"),
    readFile("src/routes/buyer.orders.tsx", "utf8"),
    readFile("src/routes/farmer.receiving.tsx", "utf8"),
    readFile("src/routes/management.products.tsx", "utf8"),
    readFile("src/routes/accounting.payments.tsx", "utf8"),
    readFile("src/routes/marketplace.index.tsx", "utf8"),
  ]);

  assert.match(hook, /window\.addEventListener\("focus", refreshWhenVisible\)/);
  assert.match(hook, /intervalMs = 5_000/);
  assert.match(hook, /agrilinkDataChangedEvent/);
  assert.match(hook, /window\.addEventListener\("storage", refreshFromStorage\)/);
  assert.match(hook, /refreshing\.current/);
  assert.match(hook, /document\.addEventListener\("visibilitychange", refreshWhenVisible\)/);
  for (const source of [farmerReceiving, managementProducts]) {
    assert.match(source, /useWorkspaceData/);
    assert.match(source, /WorkspaceLoadState/);
  }
  for (const source of [buyerCart, buyerOrders, accountingPayments, marketplace]) {
    assert.match(source, /use(?:AutoRefresh|WorkspaceData)/);
  }
});

test("successful system actions trigger immediate and cross-tab soft refreshes", async () => {
  const [root, liveRefresh, home, workspaceUser] = await Promise.all([
    readFile("src/routes/__root.tsx", "utf8"),
    readFile("src/lib/data/live-refresh.ts", "utf8"),
    readFile("src/routes/index.tsx", "utf8"),
    readFile("src/hooks/use-workspace-user.ts", "utf8"),
  ]);

  assert.match(root, /installMutationRefreshObserver/);
  assert.match(root, /router\.invalidate\(\)/);
  assert.match(root, /queryClient\.invalidateQueries\(\)/);
  assert.match(liveRefresh, /method !== "GET"/);
  assert.match(liveRefresh, /method !== "HEAD"/);
  assert.match(liveRefresh, /requestUrl\.origin === window\.location\.origin/);
  assert.match(liveRefresh, /notifyAgrilinkDataChanged\(\)/);
  assert.match(liveRefresh, /localStorage\.setItem/);
  assert.match(home, /useAutoRefresh\(\(\) => loadFeatured/);
  assert.match(workspaceUser, /useAutoRefresh\(\(\) => loadUser/);
});

test("public authentication uses the floating dialog system", async () => {
  const [home, header, loginDialog, resetDialog, loginRoute, registerRoute, resetRoute, dialog] =
    await Promise.all([
      readFile("src/routes/index.tsx", "utf8"),
      readFile("src/components/layout/site-header.tsx", "utf8"),
      readFile("src/features/auth/components/login-dialog.tsx", "utf8"),
      readFile("src/features/auth/components/password-reset-dialog.tsx", "utf8"),
      readFile("src/routes/login.tsx", "utf8"),
      readFile("src/routes/register.tsx", "utf8"),
      readFile("src/routes/forgot-password.tsx", "utf8"),
      readFile("src/components/ui/dialog.tsx", "utf8"),
    ]);
  const root = await readFile("src/routes/__root.tsx", "utf8");
  const styles = await readFile("src/styles.css", "utf8");
  const registerDialogSource = await readFile(
    "src/features/auth/components/register-dialog.tsx",
    "utf8",
  );

  assert.match(home, /<LoginDialog\s+open=\{loginOpen\}/);
  assert.match(home, /<RegisterDialog\s+open=\{registerOpen\}/);
  assert.match(home, /<PasswordResetDialog\s+open=\{passwordResetOpen\}/);
  assert.match(home, /setLoginOpen\(true\)/);
  assert.match(header, /onLogin\?: \(\) => void/);
  assert.match(
    header,
    /import \{ LoginDialog \} from "@\/features\/auth\/components\/login-dialog"/,
  );
  assert.match(
    header,
    /import \{ RegisterDialog \} from "@\/features\/auth\/components\/register-dialog"/,
  );
  assert.match(
    header,
    /import \{ PasswordResetDialog \} from "@\/features\/auth\/components\/password-reset-dialog"/,
  );
  assert.match(header, /onLogin \? onLogin\(\) : setLoginOpen\(true\)/);
  assert.match(header, /onRegister \? onRegister\(\) : setRegisterOpen\(true\)/);
  assert.match(loginDialog, /loginUser/);
  assert.match(loginDialog, /setSessionView/);
  assert.match(loginDialog, /router\.invalidate\(\)/);
  assert.match(loginDialog, /destinationForRoles/);
  assert.match(loginDialog, /Forgot password\?/);
  assert.match(loginDialog, /className="flex justify-end pt-0\.5"/);
  assert.match(loginDialog, />\s*Register\s*</);
  assert.match(loginDialog, /onForgotPassword/);
  assert.match(loginDialog, /window\.visualViewport/);
  assert.match(loginDialog, /viewport\.addEventListener\("resize", syncViewport\)/);
  assert.match(loginDialog, /scrollIntoView\(\{ block: "center", behavior: "smooth" \}\)/);
  assert.match(loginDialog, /100dvh/);
  assert.match(loginDialog, /formFocused/);
  assert.match(loginDialog, /blurTimer\.current = window\.setTimeout/);
  assert.match(loginDialog, /}, 250\)/);
  assert.match(loginDialog, /overflow-hidden overscroll-contain/);
  assert.match(loginDialog, /bg-card p-0 text-card-foreground/);
  assert.match(loginDialog, /bg-card\/95 pr-0 text-center sm:pr-0/);
  assert.match(loginDialog, /auth-login-field/);
  assert.match(
    registerDialogSource,
    /overflow-hidden overscroll-contain[\s\S]*overflow-y-auto[\s\S]*\[scrollbar-width:none\][\s\S]*\[&::-webkit-scrollbar\]:hidden/,
  );
  assert.match(registerDialogSource, /bg-card\/95 pr-0 pt-2 text-center sm:pr-0/);
  assert.match(registerDialogSource, /auth-login-field/);
  assert.match(styles, /\.dark \.auth-login-field/);
  assert.match(styles, /-webkit-text-fill-color: var\(--foreground\) !important/);
  assert.match(styles, /-webkit-box-shadow: 0 0 0 1000px var\(--background\) inset !important/);
  assert.match(dialog, /flex size-10/);
  assert.match(dialog, /rounded-full/);
  assert.match(root, /interactive-widget=resizes-content/);
  assert.match(root, /viewport-fit=cover/);
  assert.match(resetDialog, /requestPasswordResetCode/);
  assert.match(resetDialog, /completePasswordReset/);
  assert.match(loginRoute, /auth: "login"/);
  assert.match(registerRoute, /auth: "register"/);
  assert.match(resetRoute, /auth: "reset"/);
  assert.doesNotMatch(loginRoute, /auth-panel|auth-visual/);
  assert.doesNotMatch(registerRoute, /auth-panel|auth-visual/);
  assert.doesNotMatch(resetRoute, /auth-panel|auth-visual/);
});

test("home featured produce supports continuous horizontal movement", async () => {
  const home = await readFile("src/routes/index.tsx", "utf8");

  assert.match(home, /useEmblaCarousel/);
  assert.match(home, /embla-carousel-auto-scroll/);
  assert.match(home, /dragFree: true/);
  assert.match(home, /loop: true/);
  assert.match(home, /speed: 0\.8/);
  assert.match(home, /startDelay: 0/);
  assert.match(home, /autoScroll\.play\(0\)/);
  assert.match(home, /stopOnMouseEnter: true/);
  assert.match(home, /stopOnInteraction: false/);
  assert.match(home, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(home, /Previous featured products/);
  assert.doesNotMatch(home, /Next featured products/);
  assert.doesNotMatch(home, /View all products/);
  assert.match(home, /Featured produce carousel/);
  assert.match(home, /Products glide continuously/);
  assert.match(home, /cursor-grab overflow-hidden active:cursor-grabbing/);
  assert.match(home, /\.slice\(0, 8\)/);
});

test("Marketer product workflow uses one permanent catalog and preserves old URL redirects", async () => {
  const [
    marketerPage,
    marketerLayout,
    receivingPage,
    stockRecordsPage,
    rejectStockRedirect,
    pricePublishPage,
    publishedListingsPage,
  ] = await Promise.all([
    readFile("src/routes/marketer.products.tsx", "utf8"),
    readFile("src/components/workspaces/marketer-layout.tsx", "utf8"),
    readFile("src/routes/marketer.receiving.tsx", "utf8"),
    readFile("src/routes/marketer.classification.tsx", "utf8"),
    readFile("src/routes/marketer.rejects.tsx", "utf8"),
    readFile("src/routes/marketer.price-publish.tsx", "utf8"),
    readFile("src/routes/marketer.published-listings.tsx", "utf8"),
  ]);

  assert.match(marketerLayout, /Product workflow/);
  assert.match(marketerLayout, /Product Catalog/);
  assert.match(marketerLayout, /Record Stock/);
  assert.match(marketerLayout, /Stock Records/);
  assert.doesNotMatch(marketerLayout, /Reject Stock|\/marketer\/rejects/);
  assert.doesNotMatch(marketerLayout, /Price & Publish|Published Listings/);
  assert.match(marketerPage, /Permanent products/);
  assert.match(marketerPage, /Good, Semi, and Reject offers are prepared automatically as drafts/);
  assert.match(marketerPage, /Stock & owners/);
  assert.match(marketerPage, /Corrections create a separate audited inventory movement/);
  assert.match(marketerPage, /deleteCatalogProduct/);
  assert.match(marketerPage, /Delete crop/);
  assert.match(marketerPage, /Only unused crops can be deleted/);
  assert.match(marketerPage, /selected && \(!showCreate \|\| selected\.id === newProductId\)/);
  assert.match(marketerPage, /setNewProductId\(id\)/);
  assert.match(marketerPage, /setTab\("details"\)/);
  assert.match(receivingPage, /Live quality distribution/);
  assert.match(receivingPage, /marketplace totals updated/);
  assert.match(receivingPage, /name="farmerId"[\s\S]*searchable/);
  assert.match(stockRecordsPage, /saved deliveries are immutable/);
  assert.match(rejectStockRedirect, /redirect\(\{ to: "\/marketer\/classification" \}\)/);
  assert.match(pricePublishPage, /redirect\(\{ to: "\/marketer\/products" \}\)/);
  assert.match(publishedListingsPage, /redirect\(\{ to: "\/marketer\/products" \}\)/);
});

test("role workflows keep catalog, cart, and Farmer stock states consistent", async () => {
  const [marketplace, marketerCatalog, receiving, notifications] = await Promise.all([
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/routes/marketer.products.tsx", "utf8"),
    readFile("src/services/operations/receiving-server-functions.ts", "utf8"),
    readFile("src/services/messaging/notification-server.ts", "utf8"),
  ]);

  assert.match(marketplace, /cropType: z\.enum\(cropTypes\)/);
  assert.match(marketplace, /A catalog product with that name already exists/);
  assert.match(marketplace, /export const saveMarketplaceProductOffers/);
  assert.match(marketplace, /export const deleteCatalogProduct/);
  assert.match(marketplace, /This crop already has stock or transaction history/);
  assert.match(marketplace, /tx\.delete\(listings\)/);
  assert.match(marketplace, /tx\.delete\(products\)/);
  assert.match(marketplace, /Saves every Good\/Semi\/Reject setting in one transaction/);
  assert.match(marketerCatalog, /saveMarketplaceProductOffers/);
  assert.match(marketerCatalog, /Save all marketplace settings/);
  assert.match(marketerCatalog, /bundleMinimumKgChoices = \[5, 10, 15, 20, 25, 30, 50, 100\]/);
  assert.match(
    marketerCatalog,
    /ariaLabel={`\$\{offer\.classification\} bundle minimum kilograms`}/,
  );
  assert.match(marketerCatalog, /bundleMinimumKg: offer\.bundleMinimumKg === null \? "10"/);
  assert.match(marketerCatalog, /Replace quality photo/);
  assert.match(marketerCatalog, /updateMarketplaceOfferImage/);
  assert.doesNotMatch(marketerCatalog, /await updateMarketplaceListingPricing/);
  assert.doesNotMatch(marketerCatalog, /await setMarketplaceListingStatus/);
  assert.match(marketerCatalog, /requestId !== latestLoad\.current/);
  assert.match(marketplace, /offerImageUrl: listings\.imageUrl/);
  assert.match(marketplace, /inArray\(cartItems\.listingId, listingIds\)/);
  assert.match(receiving, /"Listed — partly reserved"/);
  assert.match(receiving, /"Sold out"/);
  assert.match(notifications, /eq\(users\.active, true\)/);
});

test("reordered carts and Community access protect role boundaries", async () => {
  const [marketplace, community, retirement] = await Promise.all([
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/services/messaging/community-server-functions.ts", "utf8"),
    readFile("drizzle/0021_remove_farm_consultant.sql", "utf8"),
  ]);

  assert.match(marketplace, /export const rebuildBuyerCartFromOrder/);
  assert.match(marketplace, /await db\.transaction/);
  assert.match(marketplace, /One or more products from this order are no longer available/);
  assert.match(community, /const communityRoles = \[/);
  assert.match(community, /"Accounting"/);
  assert.doesNotMatch(community, /"Buyer"/);
  assert.doesNotMatch(community, /Farm Consultant/);
  assert.match(retirement, /DROP TABLE IF EXISTS farmer_consultant_assignments/);
  assert.match(retirement, /DROP TABLE IF EXISTS guidance_messages/);
});

test("private messages enforce the Community role recipient rules", async () => {
  const [directMessages, migration, panel] = await Promise.all([
    readFile("src/services/messaging/direct-message-server-functions.ts", "utf8"),
    readFile("drizzle/0015_direct_messages.sql", "utf8"),
    readFile("src/features/messaging/components/direct-messages-panel.tsx", "utf8"),
  ]);

  assert.match(directMessages, /Management.*Marketer.*Accounting/s);
  assert.match(directMessages, /Marketer.*Farmer.*Buyer/s);
  assert.match(
    directMessages,
    /viewer\.roles\.includes\("Farmer"\)[\s\S]*?addRoleRecipients\(\["Farmer"\]\)/,
  );
  assert.match(directMessages, /viewer\.roles\.includes\("Buyer"\) && existingIds\.has\(row\.id\)/);
  assert.match(directMessages, /viewer\.roles\.includes\("Buyer"\)/);
  assert.match(directMessages, /isNotNull\(orders\.assignedRiderId\)/);
  assert.match(directMessages, /viewer\.roles\.includes\("Rider"\)/);
  assert.match(directMessages, /eq\(orders\.assignedRiderId, viewer\.id\)/);
  assert.match(directMessages, /Rider: "\/rider\/community"/);
  assert.match(directMessages, /\?contact=\$\{viewer\.id\}/);
  assert.doesNotMatch(directMessages, /Farm Consultant|farmerConsultantAssignments/);
  assert.match(directMessages, /export const getDirectConversation/);
  assert.match(directMessages, /export const sendDirectMessage/);
  assert.match(directMessages, /Your role cannot start a private message/);
  assert.match(directMessages, /New private message/);
  assert.match(directMessages, /avatarUrl: users\.avatarUrl/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS direct_messages/);
  assert.match(migration, /fk_direct_message_sender/);
  assert.match(panel, /Private messages/);
  assert.match(panel, /Message only the people your role is allowed to contact/);
  assert.match(panel, /function ContactAvatar/);
  assert.match(panel, /contact\.avatarUrl/);
});

test("Farmer Crop AI keeps the Gemini key server-only and scopes chats to each Farmer", async () => {
  const [serverSource, routeSource, migration] = await Promise.all([
    readFile("src/services/farmer/crop-ai-server-functions.ts", "utf8"),
    readFile("src/routes/farmer.crop-ai.tsx", "utf8"),
    readFile("drizzle/0022_farmer_crop_ai.sql", "utf8"),
  ]);

  assert.match(serverSource, /requireRole\("Farmer"\)/);
  assert.match(serverSource, /process\.env\["GEMINI_API_KEY"\]/);
  assert.match(serverSource, /eq\(farmerAiConversations\.farmerId, farmerId\)/);
  assert.match(
    serverSource,
    /consumeRateLimit\("farmer-crop-ai", farmer\.id, questionBurstLimit\)/,
  );
  assert.doesNotMatch(routeSource, /GEMINI_API_KEY/);
  assert.match(migration, /FOREIGN KEY \(farmer_id\) REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(
    migration,
    /FOREIGN KEY \(conversation_id\) REFERENCES farmer_ai_conversations\(id\) ON DELETE CASCADE/,
  );
});

test("community reactions and comments are saved with role checks", async () => {
  const [community, feed, migration] = await Promise.all([
    readFile("src/services/messaging/community-server-functions.ts", "utf8"),
    readFile("src/features/messaging/components/community-feed.tsx", "utf8"),
    readFile("drizzle/0011_community_reactions_and_comments.sql", "utf8"),
  ]);

  assert.match(community, /export const setCommunityReaction/);
  assert.match(community, /export const removeCommunityReaction/);
  assert.match(community, /export const postCommunityComment/);
  assert.match(community, /export const setCommunityCommentReaction/);
  assert.match(community, /export const removeCommunityCommentReaction/);
  assert.match(community, /export const updateCommunityMessage/);
  assert.match(community, /export const deleteCommunityMessage/);
  assert.match(community, /You can only edit your own Community posts/);
  assert.match(community, /You can only delete your own Community posts/);
  assert.match(community, /author\.roles\.includes\("Management"\)/);
  assert.match(community, /community\.moderation\.delete/);
  assert.match(community, /Community post removed/);
  assert.match(community, /export const setCommunityPostPinned/);
  assert.match(community, /requireAnyRole\(\["Management", "Marketer"\]\)/);
  assert.match(community, /Only Announcement posts can be pinned as official updates/);
  assert.match(community, /community\.pin/);
  assert.match(community, /community\.unpin/);
  assert.match(community, /tx\.delete\(communityComments\)/);
  assert.match(community, /tx\.delete\(communityReactions\)/);
  assert.match(community, /export const getMyCommunityMessages/);
  assert.match(community, /authorId: viewer\.id/);
  assert.match(community, /await assertCommunityMessageExists\(data\.messageId\)/);
  assert.match(community, /onDuplicateKeyUpdate/);
  assert.match(community, /community\.comment/);
  assert.match(community, /authorAvatarUrl: users\.avatarUrl/);
  assert.match(feed, /function CommunityAvatar/);
  assert.match(feed, /message\.authorAvatarUrl/);
  assert.match(feed, /comment\.authorAvatarUrl/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS community_reactions/);
  assert.match(migration, /UNIQUE KEY community_reactions_message_user_unique/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS community_comments/);
});

test("Community comments support foldable nested replies", async () => {
  const [feed, service, migration] = await Promise.all([
    readFile("src/features/messaging/components/community-feed.tsx", "utf8"),
    readFile("src/services/messaging/community-server-functions.ts", "utf8"),
    readFile("drizzle/0017_community_comment_replies.sql", "utf8"),
  ]);
  assert.match(feed, /<Reply className="size-4" \/>/);
  assert.match(feed, /aria-label=\{`Reply to \$\{comment\.author\}`\}/);
  assert.doesNotMatch(feed, /@\$\{comment\.author\}/);
  assert.match(feed, /setCommunityCommentReaction/);
  assert.match(feed, /removeCommunityCommentReaction/);
  assert.match(feed, /Show.*reply/);
  assert.match(feed, /Hide.*reply/);
  assert.match(feed, /parentCommentId: replyTarget\?\.id/);
  assert.match(service, /parentCommentId: z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(service, /Replies must belong to a top-level comment/);
  assert.match(service, /export const deleteCommunityComment/);
  assert.match(service, /You can only delete your own Community comments and replies/);
  assert.match(feed, /Delete your comment/);
  assert.match(migration, /parent_comment_id/);
  assert.match(migration, /fk_community_comment_parent/);
});

test("comment reaction migration preserves one reaction per user", async () => {
  const migration = await readFile("drizzle/0016_community_comment_reactions.sql", "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS community_comment_reactions/);
  assert.match(migration, /UNIQUE KEY community_comment_reactions_comment_user_unique/);
  assert.match(migration, /fk_community_comment_reaction_comment/);
});

test("Community search, owner controls, and Management moderation are available in the feed", async () => {
  const feed = await readFile("src/features/messaging/components/community-feed.tsx", "utf8");
  assert.match(feed, /Search Community by post or author/);
  assert.match(feed, /Share your thoughts/);
  assert.match(feed, /DialogContent/);
  assert.match(feed, /Post to Community/);
  assert.match(feed, /Post category/);
  assert.match(feed, /communityPostCategoryOptions/);
  assert.match(feed, /communityPostCategoryLabels/);
  assert.match(feed, /getCommunityMessages\(\{ data \}\)/);
  assert.match(feed, /message\.isOwner/);
  assert.match(feed, /message\.canDelete/);
  assert.match(feed, /Management moderation/);
  assert.match(feed, /Pinned official announcement/);
  assert.match(feed, /Pin announcement/);
  assert.match(feed, /setCommunityPostPinned/);
  assert.match(feed, /Post options/);
  assert.match(feed, /<MoreHorizontal/);
  assert.match(feed, /deleteCommunityMessage/);
  assert.match(feed, /updateCommunityMessage/);
});

test("Community users can view only their own saved posts from their profile", async () => {
  const [profile, feed, farmerProfile, marketerProfile, managementProfile] = await Promise.all([
    readFile("src/features/auth/components/live-profile.tsx", "utf8"),
    readFile("src/features/messaging/components/community-feed.tsx", "utf8"),
    readFile("src/routes/farmer.profile.tsx", "utf8"),
    readFile("src/routes/marketer.profile.tsx", "utf8"),
    readFile("src/routes/management.profile.tsx", "utf8"),
  ]);

  assert.match(profile, /CommunityFeed title="My Community posts" scope="mine"/);
  assert.match(feed, /getMyCommunityMessages/);
  assert.match(feed, /scope === "mine"/);
  assert.match(feed, /You have not posted in Community yet/);
  for (const source of [farmerProfile, marketerProfile, managementProfile]) {
    assert.match(source, /showCommunityPosts/);
  }
});

test("Community advanced engagement features enforce server-side permissions and safety", async () => {
  const [feed, community, profile, notifications, categories, appSelect] = await Promise.all([
    readFile("src/features/messaging/components/community-feed.tsx", "utf8"),
    readFile("src/services/messaging/community-server-functions.ts", "utf8"),
    readFile("src/features/auth/components/live-profile.tsx", "utf8"),
    readFile("src/services/messaging/notification-server.ts", "utf8"),
    readFile("src/features/messaging/community-categories.ts", "utf8"),
    readFile("src/components/ui/app-select.tsx", "utf8"),
  ]);

  assert.match(feed, /compressCommunityImage/);
  assert.match(feed, /Photo attachments/);
  assert.match(feed, /Most discussed/);
  assert.match(feed, /Unanswered questions/);
  assert.match(feed, /setCommunityPostSaved/);
  assert.match(feed, /reportCommunityPost/);
  assert.match(feed, /setCommunityQuestionStatus/);
  assert.match(feed, /Mark helpful/);
  assert.match(feed, /Management moderation/);
  assert.match(profile, /Saved Community posts/);
  assert.match(community, /Please wait 30 seconds/);
  assert.match(community, /duplicate of a post/);
  assert.match(community, /recently posted the same comment/);
  assert.match(community, /requireRole\("Management"\)/);
  assert.match(community, /notifyMentionedUsers/);
  assert.match(notifications, /targetSuffix/);
  assert.match(categories, /announcement: \["Management", "Marketer"\]/);
  assert.match(categories, /communityCategoriesForRoles/);
  assert.match(community, /Your account role cannot publish/);
  assert.match(feed, /allowedCategories/);
  assert.match(appSelect, /touch-pan-y/);
  assert.match(appSelect, /event\.currentTarget\.scrollTop \+= event\.deltaY/);
});

test("new messages and Community activity create timely recipient notifications", async () => {
  const [community, notifications, notificationCenter, communityFeed] = await Promise.all([
    readFile("src/services/messaging/community-server-functions.ts", "utf8"),
    readFile("src/services/messaging/notification-server.ts", "utf8"),
    readFile("src/features/messaging/components/notification-center.tsx", "utf8"),
    readFile("src/features/messaging/components/community-feed.tsx", "utf8"),
  ]);

  assert.match(community, /notifyCommunityUsers/);
  assert.match(community, /New Community post/);
  assert.match(community, /New comment on your post/);
  assert.match(notifications, /export async function notifyCommunityUsers/);
  assert.match(notifications, /communityTargetByRole/);
  assert.match(notifications, /excludeUserId/);
  assert.match(notificationCenter, /window\.setInterval/);
  assert.match(notificationCenter, /4_000/);
  assert.match(notificationCenter, /toast\(notification\.title/);
  assert.match(communityFeed, /Live updates are on/);
  assert.match(communityFeed, /window\.setInterval/);
  assert.match(communityFeed, /document\.visibilityState === "visible"/);
  assert.match(communityFeed, /Load more posts/);
  assert.match(communityFeed, /COMMUNITY_PAGE_SIZE = 25/);
  assert.match(communityFeed, /preservePages/);
  assert.match(communityFeed, /messagesRef\.current\.length > COMMUNITY_PAGE_SIZE/);
  assert.match(community, /pageSize: z\.number\(\)\.int\(\)\.min\(1\)\.max\(100\)/);
  assert.match(community, /\.limit\(pageSize \+ 1\)/);
  assert.match(community, /nextOffset/);
});

test("operational changes notify the users who need to respond", async () => {
  const [marketplace, receiving, accounts, notifications] = await Promise.all([
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/services/operations/receiving-server-functions.ts", "utf8"),
    readFile("src/services/auth/admin-server-functions.ts", "utf8"),
    readFile("src/services/messaging/notification-server.ts", "utf8"),
  ]);

  assert.match(receiving, /Delivery received and classified/);
  assert.match(receiving, /New farmer delivery received/);
  assert.match(accounts, /Account activated/);
  assert.match(accounts, /Account deactivated/);
  assert.match(marketplace, /New marketplace listing/);
  assert.match(marketplace, /Marketplace listing changed/);
  assert.match(marketplace, /Daily price updated/);
  assert.match(marketplace, /Daily price hidden/);
  assert.match(notifications, /export async function notifyCartHoldersForListing/);
});

test("buyers can cancel only pending orders while Marketers handle confirmed cancellations", async () => {
  const [marketplace, buyerOrders, marketerOrders] = await Promise.all([
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/routes/buyer.orders.tsx", "utf8"),
    readFile("src/routes/marketer.orders.tsx", "utf8"),
  ]);

  assert.match(marketplace, /const isMarketer = actor\.roles\.includes\("Marketer"\)/);
  assert.match(marketplace, /buyerIsCancellingOwnOrder && order\.status !== "pending"/);
  assert.match(marketplace, /Confirmed orders can only be cancelled by a Marketer/);
  assert.match(marketplace, /Only a Pending order can be cancelled/);
  assert.match(buyerOrders, /selectedOrder\.status === "Pending"/);
  assert.match(buyerOrders, /<Dialog[\s\S]*open=\{Boolean\(selectedId\)\}/);
  assert.match(buyerOrders, /Loading order details/);
  assert.match(buyerOrders, /DialogContent className="[^"]*overflow-hidden/);
  assert.match(buyerOrders, /h-full min-h-0 overflow-y-auto/);
  assert.match(buyerOrders, /Contact PROCY if you need it cancelled/);
  assert.match(marketerOrders, /cancelConfirmedOrder/);
  assert.match(marketerOrders, /Cancelled by Marketer/);
});

test("public marketplace data keeps farmer identities private while Marketer can trace ownership", async () => {
  const marketplace = await readFile(
    "src/services/marketplace/marketplace-server-functions.ts",
    "utf8",
  );
  const publicListings = marketplace.slice(
    marketplace.indexOf("async function fetchListings"),
    marketplace.indexOf("async function fetchMarketerListings"),
  );
  const marketerCatalog = marketplace.slice(
    marketplace.indexOf("export const getMarketerProductCatalog"),
    marketplace.indexOf("export const getPublishableInventory"),
  );

  assert.doesNotMatch(publicListings, /farmer: users\.displayName/);
  assert.match(marketerCatalog, /farmer: users\.displayName/);
  assert.match(marketerCatalog, /export const getMarketerProductCatalog/);
  assert.match(marketerCatalog, /requireRole\("Marketer"\)/);
});

test("retired Production Records is removed without changing historical migrations", async () => {
  const [schema, retirement, managementLayout, farmerLayout, marketplace] = await Promise.all([
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0024_remove_production_records.sql", "utf8"),
    readFile("src/components/workspaces/management-layout.tsx", "utf8"),
    readFile("src/components/workspaces/farmer-layout.tsx", "utf8"),
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
  ]);

  assert.doesNotMatch(schema, /productionRecords|production_records/);
  assert.match(retirement, /DROP TABLE IF EXISTS production_records/);
  assert.match(retirement, /entity_type = 'production_record'/);
  assert.doesNotMatch(managementLayout, /management\/production|Production Records/);
  assert.doesNotMatch(farmerLayout, /farmer\/production|Production Records/);
  assert.doesNotMatch(marketplace, /productionRecords|Recorded production entries/);
});

test("workspace identity is loaded from the authenticated server session", async () => {
  const [header, hook, roleGate, profile, buyerLayout] = await Promise.all([
    readFile("src/components/layout/site-header.tsx", "utf8"),
    readFile("src/hooks/use-workspace-user.ts", "utf8"),
    readFile("src/components/layout/role-gate.tsx", "utf8"),
    readFile("src/features/auth/components/live-profile.tsx", "utf8"),
    readFile("src/components/workspaces/buyer-layout.tsx", "utf8"),
  ]);

  assert.match(header, /getCurrentSessionUser/);
  assert.doesNotMatch(header, /demo-session/);
  assert.match(hook, /getCurrentSessionUser/);
  assert.match(hook, /user\?\.roles\.includes\(role\)/);
  assert.match(hook, /agrilink:profile-updated/);
  assert.match(hook, /avatarUrl/);
  assert.match(profile, /new CustomEvent\("agrilink:profile-updated"/);
  assert.match(buyerLayout, /<AvatarImage/);
  assert.match(buyerLayout, /buyer\.avatarUrl/);
  assert.doesNotMatch(roleGate, /demo-session/);
});

test("every signed-in role keeps theme controls inside Profile", async () => {
  const [actionBar, profile, siteHeader, ...layouts] = await Promise.all([
    readFile("src/components/workspaces/workspace-header-actions.tsx", "utf8"),
    readFile("src/features/auth/components/live-profile.tsx", "utf8"),
    readFile("src/components/layout/site-header.tsx", "utf8"),
    ...["buyer", "farmer", "marketer", "management", "accounting", "rider"].map((role) =>
      readFile(`src/components/workspaces/${role}-layout.tsx`, "utf8"),
    ),
  ]);

  assert.doesNotMatch(actionBar, /ThemeToggle/);
  assert.match(actionBar, /<NotificationCenter role=\{role\}/);
  assert.match(profile, /<ThemeToggle showLabel/);
  assert.match(profile, />Appearance</);
  assert.match(siteHeader, /!account && \(/);
  for (const layout of layouts) {
    assert.match(layout, /<WorkspaceHeaderActions role=/);
  }
});

test("Management monitoring uses saved data instead of browser demo records", async () => {
  const [marketplace, decisionSupport, products, reports, layout] = await Promise.all([
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/routes/management.decision-support.tsx", "utf8"),
    readFile("src/routes/management.products.tsx", "utf8"),
    readFile("src/routes/management.reports.tsx", "utf8"),
    readFile("src/components/workspaces/management-layout.tsx", "utf8"),
  ]);

  assert.match(marketplace, /export const getManagementDecisionSupport/);
  assert.match(marketplace, /export const getManagementProductWorkspace/);
  assert.match(decisionSupport, /getManagementDecisionSupport/);
  assert.doesNotMatch(decisionSupport, /getDemo|subscribeDemo|demo-/);
  assert.match(products, /getManagementProductWorkspace/);
  assert.match(reports, /highestAvailability/);
  assert.match(layout, /getCurrentSessionUser/);
  assert.doesNotMatch(layout, /Maria Santos/);
});

test("Management can filter and search saved user accounts by role", async () => {
  const page = await readFile("src/routes/management.users.tsx", "utf8");

  assert.match(page, /const userRoleFilters/);
  assert.match(page, /"Buyer"/);
  assert.match(page, /"Farmer"/);
  assert.doesNotMatch(page, /"Farm Consultant"/);
  assert.match(page, /const visibleUsers = useMemo/);
  assert.match(page, /Search name, email, contact, or role/);
  assert.match(page, /visibleUsers\.map/);
});

test("Management user deletion is protected by records checks and a timed confirmation", async () => {
  const [page, adminFunctions, dialog] = await Promise.all([
    readFile("src/routes/management.users.tsx", "utf8"),
    readFile("src/services/auth/admin-server-functions.ts", "utf8"),
    readFile("src/components/ui/confirm-action-dialog.tsx", "utf8"),
  ]);

  assert.match(page, /deleteManagedUser/);
  assert.match(page, /holdToConfirmMs: 3_000/);
  assert.match(adminFunctions, /export const deleteManagedUser/);
  assert.match(adminFunctions, /requireRole\("Management"\)/);
  assert.match(adminFunctions, /cannot delete your own Management account/);
  assert.match(adminFunctions, /saved operational history/);
  assert.match(adminFunctions, /Keep at least one Management account/);
  assert.match(dialog, /holdToConfirmMs/);
  assert.match(dialog, /secondsUntilConfirm > 0/);
});

test("action confirmations use the shared branded dialog instead of browser prompts", async () => {
  const files = [
    "src/routes/buyer.orders.tsx",
    "src/routes/marketer.orders.tsx",
    "src/routes/management.users.tsx",
    "src/routes/marketer.products.tsx",
    "src/features/messaging/components/community-feed.tsx",
  ];
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const dialog = await readFile("src/components/ui/confirm-action-dialog.tsx", "utf8");
  const alertDialog = await readFile("src/components/ui/alert-dialog.tsx", "utf8");

  for (const source of sources) {
    assert.match(source, /useConfirmAction/);
    assert.doesNotMatch(source, /window\.confirm/);
  }
  assert.match(dialog, /AlertDialog/);
  assert.match(dialog, /requestConfirmation/);
  assert.doesNotMatch(alertDialog, /sticky top-0/);
  assert.doesNotMatch(alertDialog, /sticky bottom-0/);
  assert.match(alertDialog, /overflow-y-auto/);
});

test("all logout actions ask for confirmation before ending the session", async () => {
  const files = [
    "src/components/layout/site-header.tsx",
    "src/components/workspaces/accounting-layout.tsx",
    "src/components/workspaces/buyer-layout.tsx",
    "src/components/workspaces/farmer-layout.tsx",
    "src/components/workspaces/management-layout.tsx",
    "src/components/workspaces/marketer-layout.tsx",
    "src/components/workspaces/rider-layout.tsx",
  ];
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const dialog = await readFile("src/components/layout/logout-confirmation.tsx", "utf8");

  for (const source of sources) {
    assert.match(source, /LogoutConfirmation/);
  }
  assert.match(dialog, /Log out of AgriLink\?/);
  assert.match(dialog, /Stay signed in/);
  assert.match(dialog, /Logging out…/);
});

test("Management dashboard keeps daily history available without altering saved records", async () => {
  const [dashboard, marketplace] = await Promise.all([
    readFile("src/routes/management.index.tsx", "utf8"),
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
  ]);

  assert.match(dashboard, /getManagementDashboard/);
  assert.match(dashboard, /DatePicker/);
  assert.match(dashboard, /All time/);
  assert.match(dashboard, /Choose dashboard year/);
  assert.match(dashboard, /This month/);
  assert.match(dashboard, /Asia\/Manila/);
  assert.match(dashboard, /Inventory flow/);
  assert.match(dashboard, /Recent activity/);
  assert.match(marketplace, /export const getManagementDashboard/);
  assert.match(marketplace, /range: z\.enum\(\["day", "month", "all"\]\)/);
  assert.match(marketplace, /requireRole\("Management"\)/);
  assert.match(marketplace, /inventoryMovements/);
  assert.match(marketplace, /inventoryFlow/);
  assert.match(marketplace, /monthlyInventoryFlow/);
  assert.match(marketplace, /monthKeysBetween/);
  assert.match(marketplace, /month <= 12/);
  assert.match(marketplace, /availableYears/);
  assert.match(marketplace, /recentActivity/);
  assert.match(marketplace, /Classified stock recorded \$\{periodLabel\}/);
});

test("delivery availability is controlled by Management and Rider access stays role-protected", async () => {
  const [
    schema,
    feeMigration,
    riderMigration,
    marketplace,
    cart,
    management,
    riderLayout,
    riderPage,
  ] = await Promise.all([
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0019_delivery_fee_settings.sql", "utf8"),
    readFile("drizzle/0020_rider_role_and_delivery_availability.sql", "utf8"),
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/routes/buyer.cart.tsx", "utf8"),
    readFile("src/routes/management.deliveries.tsx", "utf8"),
    readFile("src/components/workspaces/rider-layout.tsx", "utf8"),
    readFile("src/routes/rider.index.tsx", "utf8"),
  ]);

  assert.match(schema, /deliverySettings/);
  assert.match(schema, /deliveryFee: decimal/);
  assert.match(schema, /deliveryEnabled: boolean/);
  assert.match(feeMigration, /CREATE TABLE IF NOT EXISTS delivery_settings/);
  assert.match(feeMigration, /INSERT IGNORE INTO delivery_settings/);
  assert.match(feeMigration, /ADD COLUMN IF NOT EXISTS delivery_fee/);
  assert.match(riderMigration, /INSERT IGNORE INTO roles \(name\) VALUES \('Rider'\)/);
  assert.match(riderMigration, /ADD COLUMN IF NOT EXISTS delivery_enabled/);
  assert.match(marketplace, /fulfillment: z\.enum\(\["pickup", "delivery"\]\)/);
  assert.match(
    marketplace,
    /data\.fulfillment === "delivery" \? Number\(settings\?\.flatFee \?\? 59\) : 0/,
  );
  assert.match(marketplace, /export const updateManagementDeliveryFee/);
  assert.match(marketplace, /export const updateManagementDeliveryAvailability/);
  assert.match(marketplace, /Delivery is temporarily unavailable/);
  assert.match(marketplace, /export const getRiderDeliveryStatus/);
  assert.match(marketplace, /requireRole\("Management"\)/);
  assert.match(marketplace, /requireRole\("Rider"\)/);
  assert.match(marketplace, /export const getBuyerDeliveryFee/);
  assert.match(cart, /fulfillment === "delivery" \? deliveryFee : 0/);
  assert.match(cart, /Delivery is temporarily unavailable/);
  assert.match(cart, /Free — arrange a time with PROCY/);
  assert.match(management, /Delivery fee/);
  assert.match(management, /updateManagementDeliveryFee/);
  assert.match(management, /updateManagementDeliveryAvailability/);
  assert.match(riderLayout, /RoleGate role="Rider"/);
  assert.match(riderPage, /getRiderDeliveryStatus/);
});

test("delivery checkout collects a complete recipient and delivery address", async () => {
  const [cart, marketplace] = await Promise.all([
    readFile("src/routes/buyer.cart.tsx", "utf8"),
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
  ]);

  assert.match(cart, /type DeliveryDetails/);
  assert.match(cart, /Delivery information/);
  assert.match(cart, /Used by your assigned rider to complete the delivery\./);
  assert.match(cart, /Barangay/);
  assert.match(cart, /City \/ Municipality/);
  assert.match(cart, /Preferred delivery date and time/);
  assert.match(cart, /min-h-10 items-center leading-snug/);
  assert.doesNotMatch(cart, /delivery-region/);
  assert.doesNotMatch(cart, /philippineRegions/);
  assert.match(cart, /deliveryNote\(deliveryDetails\)/);
  assert.match(cart, /Delivery recipient:/);
  assert.match(cart, /Delivery address/);
  assert.match(marketplace, /pickupNote: z\.string\(\)\.trim\(\)\.min\(3\)\.max\(2000\)/);
});

test("delivery fulfillment keeps Operations, Rider, and Accounting responsibilities separate", async () => {
  const [
    schema,
    migration,
    marketplace,
    marketer,
    management,
    dashboard,
    layout,
    rider,
    accounting,
    orderDetails,
    buyerOrders,
    riderMessages,
    deliveryUpgrade,
    proofDialog,
    completedDeliveries,
    riderLayout,
  ] = await Promise.all([
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0035_delivery_fulfillment_flow.sql", "utf8"),
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/routes/marketer.orders.tsx", "utf8"),
    readFile("src/routes/management.deliveries.tsx", "utf8"),
    readFile("src/routes/management.index.tsx", "utf8"),
    readFile("src/components/workspaces/management-layout.tsx", "utf8"),
    readFile("src/routes/rider.index.tsx", "utf8"),
    readFile("src/routes/accounting.payments.tsx", "utf8"),
    readFile("src/features/marketplace/components/order-details.tsx", "utf8"),
    readFile("src/routes/buyer.orders.tsx", "utf8"),
    readFile("src/routes/rider.community.tsx", "utf8"),
    readFile("drizzle/0036_delivery_proof_and_cod_remittance.sql", "utf8"),
    readFile("src/features/marketplace/components/delivery-proof-dialog.tsx", "utf8"),
    readFile("src/routes/rider.completed.tsx", "utf8"),
    readFile("src/components/workspaces/rider-layout.tsx", "utf8"),
  ]);

  assert.match(schema, /fulfillmentMethod: mysqlEnum/);
  assert.match(schema, /orderFulfillmentHistory/);
  assert.match(migration, /ready_for_dispatch/);
  assert.match(migration, /assigned_rider_id/);
  assert.match(marketplace, /export const assignDeliveryRider/);
  assert.match(marketplace, /export const updateOrderFulfillment/);
  assert.match(marketplace, /title: "Rider assigned"/);
  assert.match(marketplace, /Delivery OTP:/);
  assert.match(marketplace, /export const submitDeliveryProof/);
  assert.match(marketplace, /export const reportDeliveryIssue/);
  assert.match(marketplace, /export const updateCodRemittance/);
  assert.match(marketplace, /export const getAccountingCodRemittances/);
  assert.match(marketplace, /Cash on Delivery can only be recorded for a Delivery order/);
  assert.match(marketer, /Start preparing/);
  assert.match(marketer, /Ready for dispatch/);
  assert.match(management, /Delivery dispatch/);
  assert.match(management, /Active \{activeCount\}/);
  assert.match(management, /Delivered \{completedCount\}/);
  assert.doesNotMatch(dashboard, /Delivery dispatch/);
  assert.match(layout, /Delivery Operations/);
  assert.match(layout, /\/management\/deliveries/);
  assert.match(rider, /Start delivery/);
  assert.match(rider, /Complete with proof/);
  assert.doesNotMatch(rider, /Submit COD/);
  assert.match(marketplace, /export const getRiderCompletedDeliveries/);
  assert.match(completedDeliveries, /Completed orders move here automatically/);
  assert.match(completedDeliveries, /Submit COD/);
  assert.match(completedDeliveries, /updateCodRemittance/);
  assert.match(completedDeliveries, /PaginationControls/);
  assert.match(riderLayout, /Completed deliveries/);
  assert.match(riderLayout, /\/rider\/completed/);
  assert.match(accounting, /Accounting scope/);
  assert.match(accounting, /verify the order total/);
  assert.match(orderDetails, /Assigned Rider/);
  assert.match(orderDetails, /Message Rider/);
  assert.match(orderDetails, /Delivery OTP/);
  assert.match(orderDetails, /Verified delivery receipt/);
  assert.match(buyerOrders, /assignedRiderId: detail\.assignedRiderId/);
  assert.match(buyerOrders, /canMessageRider/);
  assert.match(riderMessages, /Coordinate securely with Buyers assigned to your deliveries/);
  assert.match(deliveryUpgrade, /CREATE TABLE delivery_assignments/);
  assert.match(deliveryUpgrade, /CREATE TABLE delivery_attempts/);
  assert.match(deliveryUpgrade, /CREATE TABLE cod_remittances/);
  assert.match(proofDialog, /Buyer delivery OTP/);
  assert.match(proofDialog, /Actual recipient name/);
  assert.match(proofDialog, /Recipient name does not match/);
  assert.match(proofDialog, /Must match the delivery recipient/);
  assert.match(marketplace, /normalizeRecipientName/);
  assert.match(marketplace, /Recipient name does not match the name saved by the Buyer/);
  assert.doesNotMatch(marketplace, /proofPhotoUrl: deliveryAttempts\.proofPhotoUrl/);
  assert.match(buyerOrders, /detailsRequestRef/);
  assert.match(buyerOrders, /buyer-order-details-error/);
  assert.doesNotMatch(buyerOrders, /description: error instanceof Error \? error\.message/);
  assert.doesNotMatch(proofDialog, /Proof photo/);
  assert.doesNotMatch(proofDialog, /Recipient signature pad/);
  assert.doesNotMatch(proofDialog, /Add current location \(optional\)/);
  assert.match(management, /Assignment history/);
  assert.match(management, /activeAssignments/);
  assert.match(accounting, /Collected → Submitted → Verified → Closed/);
});

test("delivery disputes enforce a 24-hour role-protected resolution workflow", async () => {
  const [schema, migration, server, buyer, management, operational, accounting] = await Promise.all(
    [
      readFile("src/db/schema.ts", "utf8"),
      readFile("drizzle/0037_delivery_dispute_resolution.sql", "utf8"),
      readFile("src/services/marketplace/delivery-dispute-server-functions.ts", "utf8"),
      readFile("src/routes/buyer.issues.tsx", "utf8"),
      readFile("src/routes/management.disputes.tsx", "utf8"),
      readFile("src/features/marketplace/components/delivery-dispute-workspace.tsx", "utf8"),
      readFile("src/routes/accounting.refunds.tsx", "utf8"),
    ],
  );

  assert.match(schema, /deliveryDisputes/);
  assert.match(schema, /deliveryDisputeResponses/);
  assert.match(schema, /deliveryDisputeEvents/);
  assert.match(migration, /CREATE TABLE delivery_disputes/);
  assert.match(migration, /UNIQUE KEY delivery_disputes_order_unique/);
  assert.match(server, /export const createDeliveryDispute/);
  assert.match(server, /description: z\.string\(\)\.trim\(\)\.min\(3\)/);
  assert.match(server, /24 \* 60 \* 60 \* 1000/);
  assert.match(server, /requireRole\("Buyer"\)/);
  assert.match(server, /requireRole\("Management"\)/);
  assert.match(server, /requireRole\("Accounting"\)/);
  assert.match(server, /row\.order\.assignedRiderId === actor\.id/);
  assert.match(server, /export const processDeliveryDisputeRefund/);
  assert.match(buyer, /Report an issue/);
  assert.match(buyer, /Supporting photo \(optional\)/);
  assert.match(buyer, /MIN_ISSUE_DESCRIPTION_LENGTH = 3/);
  assert.match(buyer, /Choose the delivered order/);
  assert.match(buyer, /Choose an issue type/);
  assert.match(buyer, /Minimum \{MIN_ISSUE_DESCRIPTION_LENGTH\} characters/);
  assert.match(management, /Management decision/);
  assert.match(management, /Partial refund/);
  assert.match(operational, /Management makes the final\s+decision/);
  assert.match(accounting, /Approved refund queue/);
  assert.match(accounting, /Mark processed/);
});

test("Egg products use tray units throughout catalog, receiving, marketplace, and orders", async () => {
  const [units, schema, catalog, receiving, marketplace, cart, orders] = await Promise.all([
    readFile("src/features/marketplace/selling-units.ts", "utf8"),
    readFile("src/db/schema.ts", "utf8"),
    readFile("src/routes/marketer.products.tsx", "utf8"),
    readFile("src/routes/marketer.receiving.tsx", "utf8"),
    readFile("src/routes/marketplace.$productId.tsx", "utf8"),
    readFile("src/routes/buyer.cart.tsx", "utf8"),
    readFile("src/features/marketplace/components/order-details.tsx", "utf8"),
  ]);

  assert.match(units, /\(egg\|itlog\)/i);
  assert.match(units, /"kg", "piece", "bundle", "pack", "tray", "sack"/);
  assert.match(units, /unit === "kg" \? 0\.01 : 1/);
  assert.match(units, /requiresWholeSellingQuantity/);
  assert.match(schema, /"kg", "piece", "bundle", "pack", "tray", "sack"/);
  assert.match(catalog, /defaultSellingUnit\(name\)/);
  assert.match(receiving, /sellingUnitStep\(sellingUnit\)/);
  assert.match(marketplace, /requiresWholeSellingQuantity\(product\.sellingUnit\)/);
  assert.match(cart, /formatSellingQuantity\(item\.quantityKg, item\.sellingUnit\)/);
  assert.match(orders, /item\.sellingUnit \?\? "kg"/);
});

test("production workspaces use neutral session and order contracts", async () => {
  const productionFiles = await Promise.all(
    [
      "src/features/auth/components/login-dialog.tsx",
      "src/features/auth/components/register-dialog.tsx",
      "src/components/workspaces/accounting-layout.tsx",
      "src/components/workspaces/buyer-layout.tsx",
      "src/components/workspaces/farmer-layout.tsx",
      "src/components/workspaces/management-layout.tsx",
      "src/components/workspaces/marketer-layout.tsx",
      "src/components/workspaces/rider-layout.tsx",
      "src/features/marketplace/components/order-details.tsx",
      "src/routes/accounting.payments.tsx",
      "src/routes/buyer.orders.tsx",
      "src/routes/management.sales.tsx",
      "src/routes/management.transactions.tsx",
      "src/routes/marketer.orders.tsx",
      "src/services/marketplace/marketplace-server-functions.ts",
    ].map((file) => readFile(file, "utf8")),
  );
  const [sessionView, demoSession, orderRecords, products] = await Promise.all([
    readFile("src/lib/auth/session-view.ts", "utf8"),
    readFile("src/lib/demo/demo-session.ts", "utf8"),
    readFile("src/features/marketplace/order-records.ts", "utf8"),
    readFile("src/features/marketplace/products.ts", "utf8"),
  ]);

  for (const source of productionFiles) {
    assert.doesNotMatch(source, /@\/lib\/demo\//);
  }
  assert.match(sessionView, /agrilink-session-view/);
  assert.match(sessionView, /signOutCurrentAccount/);
  assert.match(demoSession, /signOutCurrentAccount as signOutDemoAccount/);
  assert.match(orderRecords, /export type OrderRecord/);
  assert.doesNotMatch(products, /demoPublicProducts/);
});

test("the first action blocks competing buttons until its mutation finishes", async () => {
  const [lock, refresh, root, shield] = await Promise.all([
    readFile("src/lib/ui/action-lock.ts", "utf8"),
    readFile("src/lib/data/live-refresh.ts", "utf8"),
    readFile("src/routes/__root.tsx", "utf8"),
    readFile("src/components/ui/action-lock-shield.tsx", "utf8"),
  ]);

  assert.match(lock, /event\.stopImmediatePropagation\(\)/);
  assert.match(lock, /beginMutatingAction/);
  assert.match(lock, /pendingMutations/);
  assert.match(lock, /data-action-pending/);
  assert.match(lock, /aria-busy/);
  assert.match(refresh, /const finishAction = isMutation \? beginMutatingAction\(\) : null/);
  assert.match(refresh, /finishAction\?\.\(\)/);
  assert.match(root, /installActionClickGuard/);
  assert.match(root, /<ActionLockShield \/>/);
  assert.match(shield, /Processing… Please wait/);
});

test("shared buttons enforce consistent action hierarchy, sizing, and loading feedback", async () => {
  const button = await readFile("src/components/ui/button.tsx", "utf8");

  assert.match(button, /default: "bg-primary text-primary-foreground/);
  assert.match(button, /destructive: "bg-destructive text-destructive-foreground/);
  assert.match(button, /secondary:\s*"border border-input bg-background/);
  assert.match(button, /outline:\s*"border border-input bg-background/);
  assert.match(button, /!rounded-xl/);
  assert.match(button, /default: "!h-10/);
  assert.match(button, /sm: "!h-9/);
  assert.match(button, /lg: "!h-11/);
  assert.match(button, /\[&_svg\]:!size-4/);
  assert.match(button, /data-\[action-pending=true\].*animate-spin/);
});

test("public landing and marketplace pages share responsive page gutters", async () => {
  const [home, marketplace] = await Promise.all([
    readFile("src/routes/index.tsx", "utf8"),
    readFile("src/routes/marketplace.index.tsx", "utf8"),
  ]);

  const sharedGutters = /px-4[^"\n]*sm:px-6[^"\n]*lg:px-8/;
  assert.match(home, sharedGutters);
  assert.match(marketplace, sharedGutters);
  assert.match(home, /items-start/);
  assert.doesNotMatch(marketplace, /max-w-6xl px-4 pb-24 pt-8/);
});

test("Farmer earnings use fixed deductions and Accounting-only cash releases", async () => {
  const [policy, settlements, accounting, farmer, management, marketplace] = await Promise.all([
    readFile("src/features/settlements/policy.ts", "utf8"),
    readFile("src/services/settlements/farmer-settlement-server-functions.ts", "utf8"),
    readFile("src/routes/accounting.farmer-payouts.tsx", "utf8"),
    readFile("src/routes/farmer.earnings.tsx", "utf8"),
    readFile("src/routes/management.index.tsx", "utf8"),
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
  ]);

  assert.match(policy, /FARMER_SERVICE_FEE_PER_KILOGRAM = 1\.25/);
  assert.match(policy, /FARMER_IPON_PER_KILOGRAM = 0\.5/);
  assert.match(policy, /FARMER_TOTAL_DEDUCTION_PER_KILOGRAM = 1\.75/);
  assert.match(marketplace, /owner\.sellingUnit === "kg"/);
  assert.match(settlements, /export const releaseFarmerCashPayout/);
  assert.match(settlements, /export const releaseFarmerIpon/);
  assert.match(settlements, /requireRole\("Accounting"\)/);
  assert.doesNotMatch(settlements, /requireRole\("Management"\)[\s\S]{0,500}releaseFarmer/);
  assert.match(accounting, /Confirm cash released/);
  assert.match(accounting, /Accounting is the only release authority/);
  assert.match(farmer, /Available earnings/);
  assert.match(farmer, /Current IPON/);
  assert.doesNotMatch(farmer, /Confirm cash released/);
  assert.match(management, /Monitoring only/);
  assert.match(marketplace, /status: "pending_payment"/);
  assert.match(marketplace, /status: "available", eligibleAt: new Date\(\)/);
});

test("completed-order feedback is Buyer-owned and measurable by Management", async () => {
  const [schema, migration, service, buyerOrders, dialog, reports] = await Promise.all([
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0040_order_feedback.sql", "utf8"),
    readFile("src/services/marketplace/order-feedback-server-functions.ts", "utf8"),
    readFile("src/routes/buyer.orders.tsx", "utf8"),
    readFile("src/features/marketplace/components/order-feedback-dialog.tsx", "utf8"),
    readFile("src/routes/management.reports.tsx", "utf8"),
  ]);

  assert.match(schema, /export const orderFeedback = mysqlTable/);
  assert.match(schema, /export const orderItemRatings = mysqlTable/);
  assert.match(migration, /CREATE TABLE order_feedback/);
  assert.match(migration, /CREATE TABLE order_item_ratings/);
  assert.match(service, /requireRole\("Buyer"\)/);
  assert.match(service, /\["picked_up", "delivered"\]\.includes/);
  assert.match(service, /Please rate every product in this order once/);
  assert.match(service, /requireRole\("Management"\)/);
  assert.match(buyerOrders, /Rate order/);
  assert.match(dialog, /Product quality/);
  assert.match(dialog, /Rider service/);
  assert.match(reports, /Completed-order ratings/);
  assert.match(reports, /Rider performance/);
});

test("daily cash closing is Accounting-owned, immutable, and visible to Management", async () => {
  const [schema, migration, service, accounting, management] = await Promise.all([
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0041_daily_cash_closing.sql", "utf8"),
    readFile("src/services/accounting/daily-closing-server-functions.ts", "utf8"),
    readFile("src/routes/accounting.daily-closing.tsx", "utf8"),
    readFile("src/routes/management.reports.tsx", "utf8"),
  ]);

  assert.match(schema, /export const dailyCashClosings = mysqlTable/);
  assert.match(schema, /export const dailyCashAdjustments = mysqlTable/);
  assert.match(migration, /daily_cash_closings_date_unique/);
  assert.match(service, /requireRole\("Accounting"\)/);
  assert.match(service, /requireAnyRole\(\["Accounting", "Management"\]\)/);
  assert.match(service, /openingCash \+ grossSales - refunds - farmerPayoutTotal - iponReleases/);
  assert.doesNotMatch(service, /openingCash \+ grossSales \+ deliveryFees/);
  assert.match(service, /already closed and locked/);
  assert.match(service, /daily_cash\.adjust/);
  assert.match(accounting, /IPON contributions/);
  assert.match(accounting, /Delivery fees are already included/);
  assert.match(management, /Monitoring only\. Accounting counts, closes/);
});
