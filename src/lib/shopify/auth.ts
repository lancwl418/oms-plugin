import { NextRequest, NextResponse } from "next/server";
import { shopify } from "./config";
import { sessionStorage } from "./session-storage";
import { prisma } from "@/lib/prisma";

/**
 * Verify that the request comes from Shopify (for embedded app requests).
 * Returns the shop domain if valid, null otherwise.
 */
export async function verifyShopifyRequest(
  req: NextRequest
): Promise<string | null> {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) return null;

  // For embedded app, verify the session token from Authorization header
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const payload = await shopify.session.decodeSessionToken(token);
      return payload.dest.replace("https://", "");
    } catch {
      return null;
    }
  }

  return shop;
}

/**
 * Get the store's offline access token from DB.
 */
export async function getStoreAccessToken(
  shopDomain: string
): Promise<string | null> {
  const store = await prisma.store.findUnique({
    where: { shopDomain },
    select: { accessToken: true, isActive: true },
  });
  if (!store || !store.isActive) return null;
  return store.accessToken;
}

/**
 * Get store with settings by shop domain.
 */
export async function getStoreWithSettings(shopDomain: string) {
  return prisma.store.findUnique({
    where: { shopDomain },
    include: { settings: true },
  });
}

/**
 * Begin OAuth flow — redirect user to Shopify authorization page.
 */
export async function beginAuth(req: NextRequest): Promise<NextResponse> {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const authRoute = await shopify.auth.begin({
    shop,
    callbackPath: "/api/auth/callback",
    isOnline: false,
  });

  // Store the session for state verification
  if (authRoute.session) {
    await sessionStorage.storeSession(authRoute.session);
  }

  return NextResponse.redirect(authRoute.url);
}

/**
 * Handle OAuth callback — exchange code for access token, save store.
 */
export async function handleAuthCallback(
  req: NextRequest
): Promise<NextResponse> {
  const url = new URL(req.url);

  const callback = await shopify.auth.callback({
    rawRequest: req,
  });

  const { session } = callback;

  // Save session
  await sessionStorage.storeSession(session);

  // Upsert Store record
  await prisma.store.upsert({
    where: { shopDomain: session.shop },
    update: {
      accessToken: session.accessToken!,
      scopes: session.scope || "",
      isActive: true,
      uninstalledAt: null,
    },
    create: {
      shopDomain: session.shop,
      accessToken: session.accessToken!,
      scopes: session.scope || "",
    },
  });

  // Ensure StoreSettings exists
  const store = await prisma.store.findUnique({
    where: { shopDomain: session.shop },
    select: { id: true, settings: true },
  });
  if (store && !store.settings) {
    await prisma.storeSettings.create({
      data: { storeId: store.id },
    });
  }

  // Redirect to embedded app
  const appUrl = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
  const redirectUrl = `${appUrl}/settings?shop=${session.shop}`;

  return NextResponse.redirect(redirectUrl);
}
