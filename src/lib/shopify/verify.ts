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
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      ),
    };
  }

  let shopDomain: string;
  try {
    const token = authHeader.replace("Bearer ", "");
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
