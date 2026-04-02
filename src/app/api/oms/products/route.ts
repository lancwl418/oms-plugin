import { NextRequest, NextResponse } from "next/server";
import { authenticateApi } from "@/lib/shopify/verify";
import { listProducts } from "@/lib/eccangtms/client";

/**
 * GET /api/oms/products — list available shipping products.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const token = auth.store.settings?.omsApiToken;
  if (!token) {
    return NextResponse.json(
      { error: "OMS API token not configured. Go to Settings." },
      { status: 400 }
    );
  }

  try {
    const products = await listProducts({
      apiToken: token,
      baseUrl: auth.store.settings?.omsBaseUrl,
    });
    return NextResponse.json(products);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch products";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
