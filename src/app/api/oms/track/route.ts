import { NextRequest, NextResponse } from "next/server";
import { authenticateApi } from "@/lib/shopify/verify";
import { getAccessToken } from "@/lib/shopify/auth";
import { getSettings } from "@/lib/shopify/metafields";
import { getTrackDetails, getTrackingNumber } from "@/lib/eccangtms/client";
import { ECCANG_TRAVEL_STATUS } from "@/lib/eccangtms/types";
import { z } from "zod";

const schema = z.object({
  orderNo: z.string().optional(),
  serverNo: z.string().optional(),
});

/**
 * POST /api/oms/track
 * Get tracking info from OMS. Passthrough.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const accessToken = getAccessToken(auth.shop);
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const settings = await getSettings(auth.shop, accessToken);
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
  const { orderNo } = parsed.data;

  try {
    // If no serverNo, get it from orderNo
    if (!serverNo && orderNo) {
      const nums = await getTrackingNumber(creds, orderNo);
      if (nums?.length > 0) serverNo = nums[0].serverNo;
    }

    if (!serverNo) {
      return NextResponse.json({
        success: true,
        message: "No tracking number assigned yet",
      });
    }

    const details = await getTrackDetails(creds, [serverNo]);
    if (!details?.length) {
      return NextResponse.json({
        success: true,
        message: "No tracking info available yet",
        trackingNumber: serverNo,
      });
    }

    const detail = details[0];
    return NextResponse.json({
      success: true,
      trackingNumber: serverNo,
      status: ECCANG_TRAVEL_STATUS[String(detail.status)] || "unknown",
      tracking: detail,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch tracking";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
