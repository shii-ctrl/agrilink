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
    authFunctions.indexOf("const httpsImageUrl"),
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

test("profile photos use optional HTTPS links and Management controls are audited", async () => {
  const [authFunctions, adminFunctions, schema, migration] = await Promise.all([
    readFile("src/services/auth/auth-functions.ts", "utf8"),
    readFile("src/services/auth/admin-server-functions.ts", "utf8"),
    readFile("src/db/schema.ts", "utf8"),
    readFile("drizzle/0009_user_profile_photos.sql", "utf8"),
  ]);

  assert.match(authFunctions, /const httpsImageUrl/);
  assert.match(authFunctions, /protocol === "https:"/);
  assert.match(authFunctions, /avatarUrl: httpsImageUrl\.nullable\(\)/);
  assert.match(schema, /avatarUrl: varchar\("avatar_url"/);
  assert.match(migration, /ADD COLUMN avatar_url/);
  assert.match(adminFunctions, /export const setManagedUserActive/);
  assert.match(adminFunctions, /Keep at least one active Management account/);
  assert.match(adminFunctions, /user\.deactivate/);
  assert.match(adminFunctions, /export const getManagementAuditLogs/);
});

test("marketplace cart controls prevent duplicate additions beyond available stock", async () => {
  const source = await readFile("src/routes/marketplace.$productId.tsx", "utf8");
  assert.match(source, /const \[isAdding, setIsAdding\] = useState\(false\)/);
  assert.match(source, /getBuyerCart\(\)/);
  assert.match(source, /remainingCartableQuantity/);
  assert.match(source, /All \$\{cartQuantityKg\} kg available is already in your cart/);
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

test("public daily prices require an active, in-stock listing", async () => {
  const marketplace = await readFile(
    "src/services/marketplace/marketplace-server-functions.ts",
    "utf8",
  );

  assert.match(marketplace, /eq\(dailyPrices\.published, true\)/);
  assert.match(marketplace, /eq\(listings\.status, "published"\)/);
  assert.match(marketplace, /inventory\.quantityKg\} - \$\{inventory\.reservedKg\} > 0/);
});

test("role workspaces refresh saved operational data while users are active", async () => {
  const [
    hook,
    buyerCart,
    buyerOrders,
    farmerReceiving,
    farmerGuidance,
    consultantProduction,
    managementProducts,
    accountingPayments,
    marketplace,
  ] = await Promise.all([
    readFile("src/hooks/use-auto-refresh.ts", "utf8"),
    readFile("src/routes/buyer.cart.tsx", "utf8"),
    readFile("src/routes/buyer.orders.tsx", "utf8"),
    readFile("src/routes/farmer.receiving.tsx", "utf8"),
    readFile("src/routes/farmer.guidance.tsx", "utf8"),
    readFile("src/routes/consultant.production.tsx", "utf8"),
    readFile("src/routes/management.products.tsx", "utf8"),
    readFile("src/routes/accounting.payments.tsx", "utf8"),
    readFile("src/routes/marketplace.index.tsx", "utf8"),
  ]);

  assert.match(hook, /window\.addEventListener\("focus", refreshWhenVisible\)/);
  assert.match(hook, /document\.addEventListener\("visibilitychange", refreshWhenVisible\)/);
  for (const source of [
    farmerReceiving,
    farmerGuidance,
    consultantProduction,
    managementProducts,
  ]) {
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
  assert.match(marketerPage, /Choose available classified stock/);
  assert.match(marketerPage, /Available stock/);
  assert.match(marketerPage, /Choose a crop type, then a quality group/);
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

test("reordered carts, community access, and crop guidance protect role boundaries", async () => {
  const [marketplace, community, guidance, admin, migration] = await Promise.all([
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/services/messaging/community-server-functions.ts", "utf8"),
    readFile("src/services/messaging/guidance-server-functions.ts", "utf8"),
    readFile("src/services/auth/admin-server-functions.ts", "utf8"),
    readFile("drizzle/0007_catalog_and_guidance_integrity.sql", "utf8"),
  ]);

  assert.match(marketplace, /export const rebuildBuyerCartFromOrder/);
  assert.match(marketplace, /await db\.transaction/);
  assert.match(marketplace, /One or more products from this order are no longer available/);
  assert.match(
    community,
    /requireAnyRole\(\["Management", "Marketer", "Farmer", "Farm Consultant"\]\)/,
  );
  assert.match(guidance, /farmerConsultantAssignments/);
  assert.match(guidance, /not assigned to your guidance workspace/);
  assert.match(admin, /export const setGuidanceAssignment/);
  assert.match(migration, /UNIQUE KEY products_name_unique/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS farmer_consultant_assignments/);
});

test("community reactions and comments are saved with role checks", async () => {
  const [community, migration] = await Promise.all([
    readFile("src/services/messaging/community-server-functions.ts", "utf8"),
    readFile("drizzle/0011_community_reactions_and_comments.sql", "utf8"),
  ]);

  assert.match(community, /export const setCommunityReaction/);
  assert.match(community, /export const removeCommunityReaction/);
  assert.match(community, /export const postCommunityComment/);
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
  assert.match(migration, /CREATE TABLE IF NOT EXISTS community_reactions/);
  assert.match(migration, /UNIQUE KEY community_reactions_message_user_unique/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS community_comments/);
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
  const [profile, feed, farmerProfile, marketerProfile, consultantProfile, managementProfile] =
    await Promise.all([
      readFile("src/features/auth/components/live-profile.tsx", "utf8"),
      readFile("src/features/messaging/components/community-feed.tsx", "utf8"),
      readFile("src/routes/farmer.profile.tsx", "utf8"),
      readFile("src/routes/marketer.profile.tsx", "utf8"),
      readFile("src/routes/consultant.profile.tsx", "utf8"),
      readFile("src/routes/management.profile.tsx", "utf8"),
    ]);

  assert.match(profile, /CommunityFeed title="My Community posts" scope="mine"/);
  assert.match(feed, /getMyCommunityMessages/);
  assert.match(feed, /scope === "mine"/);
  assert.match(feed, /You have not posted in Community yet/);
  for (const source of [farmerProfile, marketerProfile, consultantProfile, managementProfile]) {
    assert.match(source, /showCommunityPosts/);
  }
});

test("new messages and Community activity create timely recipient notifications", async () => {
  const [community, guidance, notifications, notificationCenter, communityFeed] = await Promise.all(
    [
      readFile("src/services/messaging/community-server-functions.ts", "utf8"),
      readFile("src/services/messaging/guidance-server-functions.ts", "utf8"),
      readFile("src/services/messaging/notification-server.ts", "utf8"),
      readFile("src/features/messaging/components/notification-center.tsx", "utf8"),
      readFile("src/features/messaging/components/community-feed.tsx", "utf8"),
    ],
  );

  assert.match(community, /notifyCommunityUsers/);
  assert.match(community, /New Community post/);
  assert.match(community, /New comment on your post/);
  assert.match(guidance, /New farmer guidance message/);
  assert.match(guidance, /New crop guidance/);
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
  const [marketplace, receiving, production, accounts, notifications] = await Promise.all([
    readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8"),
    readFile("src/services/operations/receiving-server-functions.ts", "utf8"),
    readFile("src/services/operations/production-server-functions.ts", "utf8"),
    readFile("src/services/auth/admin-server-functions.ts", "utf8"),
    readFile("src/services/messaging/notification-server.ts", "utf8"),
  ]);

  assert.match(receiving, /Delivery received and classified/);
  assert.match(receiving, /New farmer delivery received/);
  assert.match(production, /Production record updated/);
  assert.match(production, /Farmer production updated/);
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

test("consultants only receive production records for Farmers assigned to them", async () => {
  const production = await readFile(
    "src/services/operations/production-server-functions.ts",
    "utf8",
  );

  assert.match(production, /farmerConsultantAssignments/);
  assert.match(
    production,
    /eq\(farmerConsultantAssignments\.consultantId, filters\.consultantId\)/,
  );
  assert.match(production, /productionRows\(\{ consultantId: consultant\.id \}\)/);
});

test("workspace identity is loaded from the authenticated server session", async () => {
  const [header, hook, roleGate] = await Promise.all([
    readFile("src/components/layout/site-header.tsx", "utf8"),
    readFile("src/hooks/use-workspace-user.ts", "utf8"),
    readFile("src/components/layout/role-gate.tsx", "utf8"),
  ]);

  assert.match(header, /getCurrentSessionUser/);
  assert.doesNotMatch(header, /demo-session/);
  assert.match(hook, /getCurrentSessionUser/);
  assert.match(hook, /user\?\.roles\.includes\(role\)/);
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
  assert.match(page, /"Farm Consultant"/);
  assert.match(page, /const visibleUsers = useMemo/);
  assert.match(page, /Search name, email, contact, or role/);
  assert.match(page, /visibleUsers\.map/);
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
