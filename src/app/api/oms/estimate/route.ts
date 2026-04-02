import { NextRequest, NextResponse } from "next/server";
import { authenticateApi } from "@/lib/shopify/verify";
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
 * POST /api/oms/estimate — estimate shipping costs. Order data in, estimates out.
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
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const params = mapOrderToEccangParams(parsed.data.order, settings, "", parsed.data.packageInfo);
    const { productCode: _, ...paramsWithoutProduct } = params;
    const estimates = await calculateShipping(
      { apiToken: settings.omsApiToken, baseUrl: settings.omsBaseUrl },
      paramsWithoutProduct as typeof params
    );
    return NextResponse.json([...estimates].sort((a, b) => a.totalPrice - b.totalPrice));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to estimate";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
