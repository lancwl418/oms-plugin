import { NextRequest, NextResponse } from "next/server";
import { shopify } from "./config";

/**
 * Verify embedded app request via session token.
 * Returns shop domain or error response.
 */
export async function authenticateApi(
  req: NextRequest
): Promise<
  | { shop: string; error?: never }
  | { shop?: never; error: NextResponse }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      ),
    };
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = await shopify.session.decodeSessionToken(token);
    const shop = payload.dest.replace("https://", "");
    return { shop };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid session token" },
        { status: 401 }
      ),
    };
  }
}
