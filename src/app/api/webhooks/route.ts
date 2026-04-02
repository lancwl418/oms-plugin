import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/webhooks
 * Receives Shopify webhooks (app/uninstalled, orders/create, etc.)
 */
export async function POST(req: NextRequest) {
  const topic = req.headers.get("x-shopify-topic");
  const shop = req.headers.get("x-shopify-shop-domain");
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  if (!topic || !shop || !hmac) {
    return NextResponse.json({ error: "Missing headers" }, { status: 401 });
  }

  // Verify HMAC
  const rawBody = await req.text();
  const secret = process.env.SHOPIFY_API_SECRET!;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  if (computed !== hmac) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  switch (topic) {
    case "app/uninstalled":
      await handleAppUninstalled(shop);
      break;
    case "orders/create":
    case "orders/updated":
      await handleOrderUpsert(shop, body);
      break;
    default:
      console.log(`Unhandled webhook topic: ${topic}`);
  }

  return NextResponse.json({ ok: true });
}

async function handleAppUninstalled(shop: string) {
  await prisma.store.updateMany({
    where: { shopDomain: shop },
    data: { isActive: false, uninstalledAt: new Date() },
  });
}

async function handleOrderUpsert(shop: string, payload: Record<string, unknown>) {
  const store = await prisma.store.findUnique({
    where: { shopDomain: shop },
    select: { id: true },
  });
  if (!store) return;

  const shopifyOrderId = String(payload.id);
  const addr = payload.shipping_address as Record<string, unknown> | null;

  await prisma.order.upsert({
    where: { shopifyOrderId },
    update: {
      shopifyStatus: String(payload.financial_status || ""),
      customerName: [payload.customer && (payload.customer as Record<string, unknown>).first_name, payload.customer && (payload.customer as Record<string, unknown>).last_name].filter(Boolean).join(" ") || null,
      customerEmail: (payload.customer as Record<string, unknown>)?.email as string || null,
      shippingAddress: addr ? JSON.parse(JSON.stringify(addr)) : undefined,
      totalPrice: payload.total_price ? parseFloat(String(payload.total_price)) : undefined,
      currency: String(payload.currency || "USD"),
    },
    create: {
      storeId: store.id,
      shopifyOrderId,
      shopifyOrderNumber: payload.name ? String(payload.name) : null,
      shopifyStatus: String(payload.financial_status || ""),
      customerName: [payload.customer && (payload.customer as Record<string, unknown>).first_name, payload.customer && (payload.customer as Record<string, unknown>).last_name].filter(Boolean).join(" ") || null,
      customerEmail: (payload.customer as Record<string, unknown>)?.email as string || null,
      shippingAddress: addr ? JSON.parse(JSON.stringify(addr)) : null,
      totalPrice: payload.total_price ? parseFloat(String(payload.total_price)) : null,
      currency: String(payload.currency || "USD"),
      shopifyCreatedAt: payload.created_at ? new Date(String(payload.created_at)) : null,
    },
  });
}
