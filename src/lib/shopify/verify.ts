import { NextRequest, NextResponse } from "next/server";
import { shopify } from "./config";
import { prisma } from "@/lib/prisma";
import type { Store, StoreSettings } from "@prisma/client";

export type StoreWithSettings = Store & { settings: StoreSettings | null };

/**
 * Verify embedded app request via session token.
 * Returns store + settings or error response.
 */
export async function authenticateApi(
  req: NextRequest
): Promise<
  | { store: StoreWithSettings; error?: never }
  | { store?: never; error: NextResponse }
> {
  // App Bridge v4 sends token via Authorization header or shopify-id-token header
  const authHeader = req.headers.get("Authorization");
  const idToken = req.headers.get("shopify-id-token");
  const token = authHeader?.replace("Bearer ", "") || idToken;

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing session token" },
        { status: 401 }
      ),
    };
  }

  let shopDomain: string;
  try {
    const payload = await shopify.session.decodeSessionToken(token);
    shopDomain = payload.dest.replace("https://", "");
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid session token" },
        { status: 401 }
      ),
    };
  }

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: { settings: true },
  });

  if (!store || !store.isActive) {
    return {
      error: NextResponse.json({ error: "Store not found" }, { status: 404 }),
    };
  }

  return { store };
}
