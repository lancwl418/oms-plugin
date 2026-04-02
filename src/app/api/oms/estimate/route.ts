import { NextRequest, NextResponse } from "next/server";
import { authenticateApi } from "@/lib/shopify/verify";
import { getAccessToken } from "@/lib/shopify/auth";
import { getSettings } from "@/lib/shopify/metafields";
import { calculateShipping } from "@/lib/eccangtms/client";
import { mapOrderToEccangParams } from "@/lib/eccangtms/mapper";
import { z } from "zod";

const schema = z.object({
  order: z.object({
    orderNumber: z.string(),
    customerName: z.string().optional(),
    customerEmail: z.string().optional(),
    shippingAddress: z.record(z.string()),
    totalPrice: z.number(),
    currency: z.string().default("USD"),
  }),
  packageInfo: z.object({
    weightLbs: z.number().positive(),
    lengthIn: z.number().positive(),
    widthIn: z.number().positive(),
    heightIn: z.number().positive(),
  }),
});

/**
 * POST /api/oms/estimate
 * Estimate shipping costs. Passthrough: order data in, estimates out.
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
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { order, packageInfo } = parsed.data;

  try {
    const params = mapOrderToEccangParams(order, settings, "", packageInfo);
    const { productCode: _, ...paramsWithoutProduct } = params;
    const estimates = await calculateShipping(
      { apiToken: settings.omsApiToken, baseUrl: settings.omsBaseUrl },
      paramsWithoutProduct as typeof params
    );

    const sorted = [...estimates].sort((a, b) => a.totalPrice - b.totalPrice);
    return NextResponse.json(sorted);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to estimate";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
