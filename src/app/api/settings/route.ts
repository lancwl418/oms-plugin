import { NextRequest, NextResponse } from "next/server";
import { authenticateApi } from "@/lib/shopify/verify";
import { getAccessToken } from "@/lib/shopify/auth";
import { getSettings, saveSettings, OmsSettings } from "@/lib/shopify/metafields";

/**
 * GET /api/settings — read settings from shop metafield.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const accessToken = getAccessToken(auth.shop);
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const settings = await getSettings(auth.shop, accessToken);
  if (!settings) return NextResponse.json({});

  // Mask API token
  return NextResponse.json({
    ...settings,
    omsApiToken: settings.omsApiToken
      ? `${settings.omsApiToken.slice(0, 8)}...`
      : null,
    hasOmsToken: !!settings.omsApiToken,
  });
}

/**
 * PUT /api/settings — save settings to shop metafield.
 */
export async function PUT(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const accessToken = getAccessToken(auth.shop);
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();

  // Merge with existing settings
  const existing = await getSettings(auth.shop, accessToken);
  const merged: OmsSettings = {
    ...existing,
    ...body,
    // Keep existing token if not provided
    omsApiToken: body.omsApiToken || existing?.omsApiToken || "",
  };

  await saveSettings(auth.shop, accessToken, merged);

  return NextResponse.json({ success: true });
}
