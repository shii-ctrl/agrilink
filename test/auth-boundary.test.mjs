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

test("production responses set browser security headers", async () => {
  const server = await readFile("src/server.ts", "utf8");

  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /Strict-Transport-Security/);
  assert.match(server, /X-Frame-Options/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /Referrer-Policy/);
  assert.match(server, /Cache-Control/, "HTML account pages should not be cached");
});

test("profile photos accept secure external URLs or cropped local uploads and Management controls are audited", async () => {
  const [authFunctions, adminFunctions, schema, migration, privacyMigration, profile, avatar] =
    await Promise.all([
      readFile("src/services/auth/auth-functions.ts", "utf8"),
      readFile("src/services/auth/admin-server-functions.ts", "utf8"),
      readFile("src/db/schema.ts", "utf8"),
      readFile("drizzle/0009_user_profile_photos.sql", "utf8"),
      readFile("drizzle/0025_profile_photo_privacy.sql", "utf8"),
      readFile("src/features/auth/components/live-profile.tsx", "utf8"),
      readFile("src/components/profile-avatar.tsx", "utf8"),
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
  assert.match(profile, /Crop your profile photo/);
  assert.match(profile, /onPointerMove={moveCrop}/);
  assert.match(profile, /Rotate left/);
  assert.match(profile, /Apply crop/);
  assert.match(profile, /maximumSavedAvatarBytes = 200 \* 1024/);
  assert.match(profile, /canvas\.toDataURL\("image\/jpeg", quality\)/);
  assert.match(profile, /capture="user"/);
  assert.match(profile, /Who can see your profile photo/);
  assert.match(avatar, /onLoadingStatusChange/);
  assert.match(avatar, /profile photo enlarged/);
  assert.match(adminFunctions, /export const setManagedUserActive/);
  assert.match(adminFunctions, /Keep at least one active Management account/);
  assert.match(adminFunctions, /user\.deactivate/);
  assert.match(adminFunctions, /export const getManagementAuditLogs/);
  assert.match(adminFunctions, /export const removeManagedUserAvatar/);
  assert.match(adminFunctions, /user\.avatar\.remove/);
});

test("marketplace cart controls prevent duplicate additions beyond available stock", async () => {
  const source = await readFile("src/routes/marketplace.$productId.tsx", "utf8");
  assert.match(source, /const \[isAdding, setIsAdding\] = useState\(false\)/);
  assert.match(source, /function handleBuyNow\(\)/);
  assert.match(source, /router\.navigate\(\{ to: "\/buyer\/cart" \}\)/);
  assert.match(source, /Buy now/);
  assert.match(source, /getBuyerCart\(\)/);
  assert.match(source, /remainingCartableQuantity/);
  assert.match(source, /All \$\{cartQuantityKg\} kg available is already in your cart/);
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

test("catalog photos use a safe file picker and bundle prices are enforced at checkout", async () => {
  const [marketplace, productPage, marketerPage, schema, migration] = await Promise.all([
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/routes/marketplace.$productId.tsx", "utf8"),
    readFile("src/routes/marketer.products.tsx", "utf8"),
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0010_product_photos_and_bundle_pricing.sql", "utf8"),
  ]);

  assert.match(marketerPage, /type="file"/);
  assert.match(marketerPage, /prepareProductImage/);
  assert.doesNotMatch(marketerPage, /catalog-image-url/);
  assert.match(marketplace, /imageDataUrl/);
  assert.match(marketplace, /assertSafeProductImage/);
  assert.match(marketplace, /hasImageSignature/);
  assert.match(marketplace, /Bundle price must be lower than the retail price/);
  assert.match(marketplace, /export const updateMarketplaceListingPricing/);
  assert.match(marketplace, /listingUnitPrice\(row, item\.quantityKg\)/);
  assert.match(productPage, /Bundle: \{peso\(product\.bundlePricePerKg\)\}/);
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

test("public daily prices require an active, combined in-stock listing", async () => {
  const marketplace = await readFile(
    "src/services/marketplace/marketplace-server-functions.ts",
    "utf8",
  );

  assert.match(marketplace, /eq\(dailyPrices\.published, true\)/);
  assert.match(marketplace, /eq\(listings\.status, "published"\)/);
  assert.match(marketplace, /SUM\(stock\.quantity_kg - stock\.reserved_kg\)/);
  assert.match(marketplace, /current_listing\.status/);
  assert.match(marketplace, /classifications\.name\} <> 'Reject'/);
});

test("marketplace publishing protects combined stock, reject quality, and older carts", async () => {
  const marketplace = await readFile(
    "src/services/marketplace/marketplace-server-functions.ts",
    "utf8",
  );

  assert.match(marketplace, /Reject stock is kept internally and cannot be shown to buyers/);
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
  assert.match(hook, /document\.addEventListener\("visibilitychange", refreshWhenVisible\)/);
  for (const source of [farmerReceiving, managementProducts]) {
    assert.match(source, /useWorkspaceData/);
    assert.match(source, /WorkspaceLoadState/);
  }
  for (const source of [buyerCart, buyerOrders, accountingPayments, marketplace]) {
    assert.match(source, /use(?:AutoRefresh|WorkspaceData)/);
  }
});

test("public authentication uses the floating dialog system", async () => {
  const [home, header, loginDialog, resetDialog, loginRoute, registerRoute, resetRoute] =
    await Promise.all([
      readFile("src/routes/index.tsx", "utf8"),
      readFile("src/components/layout/site-header.tsx", "utf8"),
      readFile("src/features/auth/components/login-dialog.tsx", "utf8"),
      readFile("src/features/auth/components/password-reset-dialog.tsx", "utf8"),
      readFile("src/routes/login.tsx", "utf8"),
      readFile("src/routes/register.tsx", "utf8"),
      readFile("src/routes/forgot-password.tsx", "utf8"),
    ]);

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
  assert.match(loginDialog, /Register as Buyer/);
  assert.match(loginDialog, /onForgotPassword/);
  assert.match(resetDialog, /requestPasswordResetCode/);
  assert.match(resetDialog, /completePasswordReset/);
  assert.match(loginRoute, /auth: "login"/);
  assert.match(registerRoute, /auth: "register"/);
  assert.match(resetRoute, /auth: "reset"/);
  assert.doesNotMatch(loginRoute, /auth-panel|auth-visual/);
  assert.doesNotMatch(registerRoute, /auth-panel|auth-visual/);
  assert.doesNotMatch(resetRoute, /auth-panel|auth-visual/);
});

test("Marketer product listing uses separate workflow pages without removing existing tools", async () => {
  const [marketerPage, marketerLayout, pricePublishPage, publishedListingsPage] = await Promise.all(
    [
      readFile("src/routes/marketer.products.tsx", "utf8"),
      readFile("src/components/workspaces/marketer-layout.tsx", "utf8"),
      readFile("src/routes/marketer.price-publish.tsx", "utf8"),
      readFile("src/routes/marketer.published-listings.tsx", "utf8"),
    ],
  );

  assert.match(marketerLayout, /Product workflow/);
  assert.match(marketerLayout, /Add Product/);
  assert.match(marketerLayout, /Price & Publish/);
  assert.match(marketerLayout, /Published Listings/);
  assert.match(marketerPage, /view === "catalog"/);
  assert.match(marketerPage, /view === "publish"/);
  assert.match(marketerPage, /view === "listings"/);
  assert.match(pricePublishPage, /MarketerProductsPage view="publish"/);
  assert.match(publishedListingsPage, /MarketerProductsPage view="listings"/);
  assert.match(marketerPage, /Add product to catalog/);
  assert.match(marketerPage, /Choose product and quality/);
  assert.match(marketerPage, /Available stock/);
  assert.match(marketerPage, /Search, then choose the product and quality you want to price/);
  assert.match(marketerPage, /Search product, crop type, or quality/);
  assert.match(marketerPage, /\["Good", "Semi", "Reject"\]/);
  assert.match(marketerPage, /Buyer price preview/);
  assert.match(marketerPage, /<Link\s+to="\/marketer\/receiving"/);
  assert.match(marketerPage, /PROCY marketplace listings/);
  assert.doesNotMatch(
    marketerPage,
    /Listing Assistant|First listing guide|Tabs(?:List|Content|Trigger)/,
  );
});

test("role workflows keep catalog, cart, and Farmer stock states consistent", async () => {
  const [marketplace, receiving, notifications] = await Promise.all([
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/services/operations/receiving-server-functions.ts", "utf8"),
    readFile("src/services/messaging/notification-server.ts", "utf8"),
  ]);

  assert.match(marketplace, /cropType: z\.enum\(cropTypes\)/);
  assert.match(marketplace, /A catalog product with that name already exists/);
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

test("Community search and owner-only post controls are available in the feed", async () => {
  const feed = await readFile("src/features/messaging/components/community-feed.tsx", "utf8");
  assert.match(feed, /Search Community by post or author/);
  assert.match(feed, /getCommunityMessages\(\{ data \}\)/);
  assert.match(feed, /message\.isOwner/);
  assert.match(feed, /Edit post/);
  assert.match(feed, /Delete post/);
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
  assert.match(buyerOrders, /order\.status === "Pending"/);
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
  const marketerListings = marketplace.slice(
    marketplace.indexOf("async function fetchMarketerListings"),
    marketplace.indexOf("export const createCatalogProduct"),
  );

  assert.doesNotMatch(publicListings, /farmer: users\.displayName/);
  assert.match(marketerListings, /farmer: users\.displayName/);
  assert.match(marketerListings, /export const getMarketerMarketplaceListings/);
  assert.match(marketerListings, /requireRole\("Marketer"\)/);
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

  for (const source of sources) {
    assert.match(source, /useConfirmAction/);
    assert.doesNotMatch(source, /window\.confirm/);
  }
  assert.match(dialog, /AlertDialog/);
  assert.match(dialog, /requestConfirmation/);
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
    readFile("src/routes/management.index.tsx", "utf8"),
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
