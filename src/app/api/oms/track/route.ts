import { NextRequest, NextResponse } from "next/server";
import { authenticateApi, getOmsCredentials } from "@/lib/shopify/verify";
import { getTrackDetails, getTrackingNumber } from "@/lib/eccangtms/client";
import { ECCANG_TRAVEL_STATUS } from "@/lib/eccangtms/types";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const trackSchema = z.object({
  orderId: z.string(),
});

/**
 * POST /api/oms/track
 * Get tracking details for an order's OMS shipment.
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
  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { orderId } = parsed.data;

  const shipment = await prisma.shipment.findFirst({
    where: { orderId, storeId: auth.store.id, omsOrderNo: { not: null } },
  });

  if (!shipment) {
    return NextResponse.json(
      { error: "No OMS shipment found for this order" },
      { status: 404 }
    );
  }

  let serverNo = shipment.omsServerNo || shipment.trackingNumber;

  try {
    // If serverNo missing, try fetching it
    if (!serverNo && shipment.omsOrderNo) {
      const trackingNumbers = await getTrackingNumber(creds, shipment.omsOrderNo);
      if (trackingNumbers?.length > 0 && trackingNumbers[0].serverNo) {
        serverNo = trackingNumbers[0].serverNo;
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: { omsServerNo: serverNo, trackingNumber: serverNo },
        });
      }
    }

    if (!serverNo) {
      return NextResponse.json({
        success: true,
        message: "No tracking number assigned yet",
        shipment,
      });
    }

    // Get tracking details
    let details;
    try {
      details = await getTrackDetails(creds, [serverNo]);
    } catch {
      return NextResponse.json({
        success: true,
        message: "No tracking info available yet",
        shipment: { ...shipment, trackingNumber: serverNo },
      });
    }

    if (!details || details.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No tracking info available yet",
        shipment: { ...shipment, trackingNumber: serverNo },
      });
    }

    const detail = details[0];
    const mappedStatus =
      ECCANG_TRAVEL_STATUS[String(detail.status)] || "unknown";

    // Update shipment status
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: mappedStatus,
        trackingNumber: serverNo,
        ...(mappedStatus === "delivered"
          ? { deliveredAt: new Date(detail.lastDate) }
          : {}),
        ...(mappedStatus === "in_transit" || mappedStatus === "collected"
          ? { shippedAt: shipment.shippedAt || new Date() }
          : {}),
      },
    });

    // Update order label status if synced
    if (mappedStatus === "delivered") {
      await prisma.order.update({
        where: { id: orderId },
        data: { labelStatus: "SYNCED" },
      });
    }

    return NextResponse.json({
      success: true,
      tracking: detail,
      mappedStatus,
      trackingNumber: serverNo,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch tracking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
