import { NextRequest, NextResponse } from "next/server";
import { authenticateApi } from "@/lib/shopify/verify";
import { createOrder, getTrackingNumber } from "@/lib/eccangtms/client";
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
  productCode: z.string().min(1),
  packageInfo: z.object({
    weightLbs: z.number().positive(),
    lengthIn: z.number().positive(),
    widthIn: z.number().positive(),
    heightIn: z.number().positive(),
  }),
});

/**
 * POST /api/oms/push — create shipping label. Order data in, label result out.
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

  const { order, productCode, packageInfo } = parsed.data;
  const creds = { apiToken: settings.omsApiToken, baseUrl: settings.omsBaseUrl };

  try {
    const params = mapOrderToEccangParams(order, settings, productCode, packageInfo);
    const result = await createOrder(creds, params);

    let serverNo = result.serverNo || null;
    if (!serverNo && result.orderNo) {
      try {
        const nums = await getTrackingNumber(creds, result.orderNo);
        if (nums?.length > 0) serverNo = nums[0].serverNo;
      } catch {
        // Will be available later
      }
    }

    return NextResponse.json({
      success: true,
      orderNo: result.orderNo,
      serverNo,
      productName: result.productName,
      totalPrice: result.totalPrice,
      status: result.status,
      feeDetail: result.feeDetail,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create label";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
