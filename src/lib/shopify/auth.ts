import { NextRequest, NextResponse } from "next/server";
import { shopify } from "./config";

/**
 * In-memory store for OAuth sessions and access tokens.
 * In production, use Redis or similar for multi-instance deploys.
 */
const tokenStore = new Map<string, string>(); // shop -> accessToken

export function getAccessToken(shop: string): string | null {
  return tokenStore.get(shop) || null;
}

export function setAccessToken(shop: string, token: string) {
  tokenStore.set(shop, token);
}

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
  });

  return NextResponse.redirect(authRoute.url);
}

/**
 * Handle OAuth callback — exchange code for access token.
 */
export async function handleAuthCallback(
  req: NextRequest
): Promise<NextResponse> {
  const callback = await shopify.auth.callback({
    rawRequest: req,
  });

  const { session } = callback;

  // Store access token in memory
  setAccessToken(session.shop, session.accessToken!);

  // Redirect to embedded app settings
  const appUrl = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/settings?shop=${session.shop}`);
}
