import { NextRequest, NextResponse } from "next/server";
import { authenticateApi, getOmsCredentials } from "@/lib/shopify/verify";
import { calculateShipping } from "@/lib/eccangtms/client";
import { mapOrderToEccangParams } from "@/lib/eccangtms/mapper";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const estimateSchema = z.object({
  orderId: z.string(),
  packageInfo: z.object({
    weightLbs: z.number().positive(),
    lengthIn: z.number().positive(),
    widthIn: z.number().positive(),
    heightIn: z.number().positive(),
  }),
});

/**
 * POST /api/oms/estimate
 * Estimate shipping costs for an order.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const creds = getOmsCredentials(auth.store.settings);
  if (!creds) {
    return NextResponse.json(
      { error: "OMS API token not configured" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = estimateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { orderId, packageInfo } = parsed.data;

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: auth.store.id },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!order.shippingAddress) {
    return NextResponse.json(
      { error: "Order has no shipping address" },
      { status: 400 }
    );
  }

  try {
    const params = mapOrderToEccangParams(
      {
        orderNumber: order.shopifyOrderNumber || order.id.slice(0, 8),
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        shippingAddress: order.shippingAddress as Record<string, string>,
        totalPrice: order.totalPrice ? parseFloat(String(order.totalPrice)) : 10,
        currency: order.currency,
      },
      auth.store.settings!,
      "",
      packageInfo
    );

    // Remove productCode to estimate across all products
    const { productCode: _, ...paramsWithoutProduct } = params;
    const estimates = await calculateShipping(
      creds,
      paramsWithoutProduct as typeof params
    );

    const sorted = [...estimates].sort((a, b) => a.totalPrice - b.totalPrice);
    return NextResponse.json(sorted);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to estimate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
