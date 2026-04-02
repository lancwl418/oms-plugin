import { NextRequest, NextResponse } from "next/server";
import { authenticateApi, getOmsCredentials } from "@/lib/shopify/verify";
import { createOrder, getTrackingNumber } from "@/lib/eccangtms/client";
import { mapOrderToEccangParams } from "@/lib/eccangtms/mapper";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const pushSchema = z.object({
  orderId: z.string(),
  productCode: z.string().min(1),
  packageInfo: z.object({
    weightLbs: z.number().positive(),
    lengthIn: z.number().positive(),
    widthIn: z.number().positive(),
    heightIn: z.number().positive(),
  }),
});

/**
 * POST /api/oms/push
 * Push order to OMS to create shipping label.
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
  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { orderId, productCode, packageInfo } = parsed.data;

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: auth.store.id },
    include: { shipments: true },
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

  // Check if already pushed
  const existingOms = order.shipments.find(
    (s) => s.omsOrderNo !== null
  );
  if (existingOms) {
    return NextResponse.json(
      { error: "Order already pushed to OMS", shipment: existingOms },
      { status: 409 }
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
      productCode,
      packageInfo
    );

    const result = await createOrder(creds, params);

    // Try to get serverNo (tracking number)
    let serverNo = result.serverNo || null;
    if (!serverNo && result.orderNo) {
      try {
        const trackingNumbers = await getTrackingNumber(creds, result.orderNo);
        if (trackingNumbers?.length > 0 && trackingNumbers[0].serverNo) {
          serverNo = trackingNumbers[0].serverNo;
        }
      } catch {
        // Will be fetched later via track endpoint
      }
    }

    // Create shipment record
    const shipment = await prisma.shipment.create({
      data: {
        storeId: auth.store.id,
        orderId: order.id,
        omsOrderNo: result.orderNo,
        omsServerNo: serverNo,
        productCode: result.productCode,
        productName: result.productName,
        trackingNumber: serverNo,
        carrier: result.productName || productCode,
        shippingCost: result.totalPrice,
        status: result.status === 1 ? "label_created" : "pending",
        rawResponse: JSON.parse(JSON.stringify(result)),
      },
    });

    // Update order label status
    await prisma.order.update({
      where: { id: order.id },
      data: { labelStatus: "CREATED" },
    });

    return NextResponse.json({
      success: true,
      shipment,
      omsOrder: {
        orderNo: result.orderNo,
        serverNo,
        productName: result.productName,
        totalPrice: result.totalPrice,
        status: result.status,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to push to OMS";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
