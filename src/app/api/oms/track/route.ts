import { NextRequest, NextResponse } from "next/server";
import { authenticateApi } from "@/lib/shopify/verify";
import { getTrackDetails, getTrackingNumber } from "@/lib/eccangtms/client";
import { pushFulfillmentToShopify } from "@/lib/shopify/fulfillments";
import { ECCANG_TRAVEL_STATUS } from "@/lib/eccangtms/types";
import { z } from "zod";

const schema = z.object({
  orderNo: z.string().optional(),
  serverNo: z.string().optional(),
  // For auto-pushing fulfillment back to Shopify
  shopifyOrderId: z.string().optional(),
  autoFulfill: z.boolean().default(false),
});

/**
 * POST /api/oms/track
 * Get tracking info from OMS.
 * If autoFulfill=true and shopifyOrderId provided, pushes tracking to Shopify automatically.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const settings = auth.store.settings;
  if (!settings?.omsApiToken) {
    return NextResponse.json({ error: "OMS API token not configured" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide orderNo or serverNo" }, { status: 400 });
  }

  const creds = { apiToken: settings.omsApiToken, baseUrl: settings.omsBaseUrl };
  let { serverNo } = parsed.data;
  const { orderNo, shopifyOrderId, autoFulfill } = parsed.data;

  try {
    // Step 1: If no serverNo, get it from orderNo
    if (!serverNo && orderNo) {
      try {
        const nums = await getTrackingNumber(creds, orderNo);
        if (nums?.length > 0) serverNo = nums[0].serverNo;
      } catch {
        // Not ready yet
      }
    }

    if (!serverNo) {
      return NextResponse.json({
        success: true,
        message: "No tracking number assigned yet",
      });
    }

    // Step 2: Auto-push fulfillment to Shopify if requested
    let fulfillmentResult = null;
    if (autoFulfill && shopifyOrderId) {
      try {
        fulfillmentResult = await pushFulfillmentToShopify({
          shopDomain: auth.store.shopDomain,
          accessToken: auth.store.accessToken,
          shopifyOrderId,
          trackingNumber: serverNo,
          carrier: "USPS",
        });
      } catch (syncErr) {
        console.warn("Auto-sync to Shopify failed:", syncErr);
        fulfillmentResult = {
          error: syncErr instanceof Error ? syncErr.message : "Sync failed",
        };
      }
    }

    // Step 3: Get tracking details
    let details;
    try {
      details = await getTrackDetails(creds, [serverNo]);
    } catch {
      return NextResponse.json({
        success: true,
        message: "No tracking info available yet",
        trackingNumber: serverNo,
        fulfillment: fulfillmentResult,
      });
    }

    if (!details?.length) {
      return NextResponse.json({
        success: true,
        message: "No tracking info available yet",
        trackingNumber: serverNo,
        fulfillment: fulfillmentResult,
      });
    }

    const detail = details[0];
    return NextResponse.json({
      success: true,
      trackingNumber: serverNo,
      status: ECCANG_TRAVEL_STATUS[String(detail.status)] || "unknown",
      tracking: detail,
      fulfillment: fulfillmentResult,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch tracking";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
