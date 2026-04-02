import { NextRequest, NextResponse } from "next/server";
import { authenticateApi, getOmsCredentials } from "@/lib/shopify/verify";
import { listProducts } from "@/lib/eccangtms/client";

/**
 * GET /api/oms/products
 * List available shipping products from OMS.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const creds = getOmsCredentials(auth.store.settings);
  if (!creds) {
    return NextResponse.json(
      { error: "OMS API token not configured. Go to Settings to set it up." },
      { status: 400 }
    );
  }

  try {
    const products = await listProducts(creds);
    return NextResponse.json(products);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch products";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
