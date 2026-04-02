const API_VERSION = "2025-01";

/**
 * Push a fulfillment (tracking number + carrier) back to Shopify.
 * Multi-tenant: takes shop domain + access token per store.
 *
 * If open fulfillment orders exist, creates a new fulfillment.
 * If the order is already fulfilled, updates tracking on the existing fulfillment.
 */
export async function pushFulfillmentToShopify(params: {
  shopDomain: string;
  accessToken: string;
  shopifyOrderId: string;
  trackingNumber: string;
  carrier: string;
  trackingUrl?: string;
  notify?: boolean;
}): Promise<{
  fulfillmentId: string;
  status: string;
}> {
  const baseUrl = `https://${params.shopDomain}/admin/api/${API_VERSION}`;
  const token = params.accessToken;

  // Step 1: Get fulfillment orders
  const foRes = await fetch(
    `${baseUrl}/orders/${params.shopifyOrderId}/fulfillment_orders.json`,
    { headers: { "X-Shopify-Access-Token": token } }
  );

  if (!foRes.ok) {
    const errText = await foRes.text();
    throw new Error(
      `Shopify API error ${foRes.status} fetching fulfillment orders: ${errText.substring(0, 200)}`
    );
  }

  const foData = (await foRes.json()) as {
    fulfillment_orders: Array<{
      id: number;
      status: string;
      line_items: Array<{ id: number; fulfillable_quantity: number }>;
    }>;
  };

  // Find fulfillable orders
  const fulfillableOrders = foData.fulfillment_orders.filter(
    (fo) =>
      fo.status === "open" ||
      fo.status === "in_progress" ||
      fo.status === "scheduled"
  );

  if (fulfillableOrders.length > 0) {
    return createFulfillment(baseUrl, token, fulfillableOrders, params);
  }

  // No fulfillable orders — try updating tracking on existing fulfillment
  return updateExistingFulfillmentTracking(baseUrl, token, params);
}

async function createFulfillment(
  baseUrl: string,
  token: string,
  openFulfillmentOrders: Array<{
    id: number;
    line_items: Array<{ id: number; fulfillable_quantity: number }>;
  }>,
  params: {
    trackingNumber: string;
    carrier: string;
    trackingUrl?: string;
    notify?: boolean;
  }
) {
  const lineItemsByFulfillmentOrder = openFulfillmentOrders.map((fo) => ({
    fulfillment_order_id: fo.id,
    fulfillment_order_line_items: fo.line_items
      .filter((li) => li.fulfillable_quantity > 0)
      .map((li) => ({ id: li.id, quantity: li.fulfillable_quantity })),
  }));

  const body = {
    fulfillment: {
      line_items_by_fulfillment_order: lineItemsByFulfillmentOrder,
      tracking_info: {
        number: params.trackingNumber,
        company: params.carrier,
        url: params.trackingUrl || undefined,
      },
      notify_customer: params.notify !== false,
    },
  };

  const res = await fetch(`${baseUrl}/fulfillments.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Shopify API error ${res.status} creating fulfillment: ${errText}`
    );
  }

  const data = (await res.json()) as {
    fulfillment: { id: number; status: string };
  };

  return {
    fulfillmentId: String(data.fulfillment.id),
    status: data.fulfillment.status,
  };
}

async function updateExistingFulfillmentTracking(
  baseUrl: string,
  token: string,
  params: {
    shopifyOrderId: string;
    trackingNumber: string;
    carrier: string;
    trackingUrl?: string;
    notify?: boolean;
  }
) {
  const listRes = await fetch(
    `${baseUrl}/orders/${params.shopifyOrderId}/fulfillments.json`,
    { headers: { "X-Shopify-Access-Token": token } }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(
      `Shopify API error ${listRes.status} fetching fulfillments: ${errText.substring(0, 200)}`
    );
  }

  const listData = (await listRes.json()) as {
    fulfillments: Array<{
      id: number;
      status: string;
      tracking_number: string | null;
    }>;
  };

  if (listData.fulfillments.length === 0) {
    throw new Error(
      `No fulfillments found for Shopify order ${params.shopifyOrderId}`
    );
  }

  // Prefer a fulfillment without tracking, otherwise use the first one
  const target =
    listData.fulfillments.find((f) => !f.tracking_number) ||
    listData.fulfillments[0];

  const body = {
    fulfillment: {
      tracking_info: {
        number: params.trackingNumber,
        company: params.carrier,
        url: params.trackingUrl || undefined,
      },
      notify_customer: params.notify !== false,
    },
  };

  const updateRes = await fetch(
    `${baseUrl}/fulfillments/${target.id}/update_tracking.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(
      `Shopify API error ${updateRes.status} updating tracking: ${errText}`
    );
  }

  const updateData = (await updateRes.json()) as {
    fulfillment: { id: number; status: string };
  };

  return {
    fulfillmentId: String(updateData.fulfillment.id),
    status: updateData.fulfillment.status,
  };
}
