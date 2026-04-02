import { NextRequest, NextResponse } from "next/server";
import { shopify } from "./config";
import { sessionStorage } from "./session-storage";
import { prisma } from "@/lib/prisma";

/**
 * Begin OAuth — redirect to Shopify authorization page.
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
    rawRequest: req,
  });

  if (authRoute.session) {
    await sessionStorage.storeSession(authRoute.session);
  }

  return NextResponse.redirect(authRoute.url);
}

/**
 * Handle OAuth callback — exchange code for access token, save store to DB.
 */
export async function handleAuthCallback(
  req: NextRequest
): Promise<NextResponse> {
  const callback = await shopify.auth.callback({
    rawRequest: req,
  });

  const { session } = callback;
  await sessionStorage.storeSession(session);

  // Upsert Store record
  const store = await prisma.store.upsert({
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
  const existing = await prisma.storeSettings.findUnique({
    where: { storeId: store.id },
  });
  if (!existing) {
    await prisma.storeSettings.create({ data: { storeId: store.id } });
  }

  const appUrl = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/settings?shop=${session.shop}`);
}
