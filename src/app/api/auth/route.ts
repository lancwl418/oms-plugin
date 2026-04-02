import { NextRequest } from "next/server";
import { beginAuth } from "@/lib/shopify/auth";

/**
 * GET /api/auth?shop=xxx.myshopify.com
 * Starts Shopify OAuth flow.
 */
export async function GET(req: NextRequest) {
  return beginAuth(req);
}
