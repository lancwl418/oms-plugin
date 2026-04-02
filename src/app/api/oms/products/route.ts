import { NextRequest, NextResponse } from "next/server";
import { authenticateApi } from "@/lib/shopify/verify";
import { getAccessToken } from "@/lib/shopify/auth";
import { getSettings } from "@/lib/shopify/metafields";
import { listProducts } from "@/lib/eccangtms/client";

/**
 * GET /api/oms/products
 * List available shipping products from OMS. Pure passthrough.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const accessToken = getAccessToken(auth.shop);
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const settings = await getSettings(auth.shop, accessToken);
  if (!settings?.omsApiToken) {
    return NextResponse.json(
      { error: "OMS API token not configured. Go to Settings." },
      { status: 400 }
    );
  }

  try {
    const products = await listProducts({
      apiToken: settings.omsApiToken,
      baseUrl: settings.omsBaseUrl,
    });
    return NextResponse.json(products);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch products";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
