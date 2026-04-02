import { NextRequest } from "next/server";
import { handleAuthCallback } from "@/lib/shopify/auth";

/**
 * GET /api/auth/callback
 * Shopify OAuth callback — exchanges code for access token.
 */
export async function GET(req: NextRequest) {
  return handleAuthCallback(req);
}
