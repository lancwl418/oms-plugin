import { NextRequest, NextResponse } from "next/server";
import { authenticateApi } from "@/lib/shopify/verify";
import { pushFulfillmentToShopify } from "@/lib/shopify/fulfillments";
import { z } from "zod";

const schema = z.object({
  shopifyOrderId: z.string(),
  trackingNumber: z.string(),
  carrier: z.string().default("USPS"),
  trackingUrl: z.string().optional(),
  notify: z.boolean().default(true),
});

/**
 * POST /api/oms/fulfill
 * Push tracking number back to Shopify as a fulfillment.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await pushFulfillmentToShopify({
      shopDomain: auth.store.shopDomain,
      accessToken: auth.store.accessToken,
      shopifyOrderId: parsed.data.shopifyOrderId,
      trackingNumber: parsed.data.trackingNumber,
      carrier: parsed.data.carrier,
      trackingUrl: parsed.data.trackingUrl,
      notify: parsed.data.notify,
    });

    return NextResponse.json({
      success: true,
      fulfillmentId: result.fulfillmentId,
      status: result.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to push fulfillment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
