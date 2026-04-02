import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: (process.env.SHOPIFY_SCOPES || "read_orders,write_orders").split(","),
  hostName: new URL(process.env.SHOPIFY_APP_URL || "http://localhost:3000").hostname,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});
