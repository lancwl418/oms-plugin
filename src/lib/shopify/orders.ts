import type { OrderForLabel } from "@/lib/eccangtms/mapper";

const API_VERSION = "2025-01";

/**
 * Extract numeric ID from Shopify GID.
 * "gid://shopify/Order/12345" → "12345"
 */
function extractNumericId(gidOrId: string): string {
  const match = gidOrId.match(/(\d+)$/);
  return match ? match[1] : gidOrId;
}

/**
 * Fetch a Shopify order by ID and return data needed for label creation.
 */
export async function fetchShopifyOrder(
  shopDomain: string,
  accessToken: string,
  orderId: string
): Promise<OrderForLabel & { orderNumericId: string }> {
  const numericId = extractNumericId(orderId);
  const url = `https://${shopDomain}/admin/api/${API_VERSION}/orders/${numericId}.json?fields=id,name,order_number,email,shipping_address,total_price,currency,customer`;

  const res = await fetch(url, {
    headers: { "X-Shopify-Access-Token": accessToken },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Shopify API error ${res.status} fetching order: ${errText.substring(0, 200)}`
    );
  }

  const data = (await res.json()) as {
    order: {
      id: number;
      name: string;
      order_number: number;
      email: string | null;
      total_price: string;
      currency: string;
      shipping_address: Record<string, string> | null;
      customer?: { first_name?: string; last_name?: string } | null;
    };
  };

  const o = data.order;
  const customerName = o.customer
    ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
    : null;

  return {
    orderNumber: o.name,
    customerName,
    customerEmail: o.email,
    shippingAddress: o.shipping_address || {},
    totalPrice: parseFloat(o.total_price) || 0,
    currency: o.currency || "USD",
    orderNumericId: String(o.id),
  };
}
