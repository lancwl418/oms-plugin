import { shopify } from "./config";

const NAMESPACE = "oms_label";
const SETTINGS_KEY = "settings";

export interface OmsSettings {
  omsApiToken: string;
  omsBaseUrl?: string;
  shipperName?: string;
  shipperCompanyName?: string;
  shipperCountryCode?: string;
  shipperState?: string;
  shipperCity?: string;
  shipperAddress1?: string;
  shipperAddress2?: string;
  shipperPostCode?: string;
  shipperPhone?: string;
  shipperEmail?: string;
  defaultWeightLbs?: number;
  defaultLengthIn?: number;
  defaultWidthIn?: number;
  defaultHeightIn?: number;
}

/**
 * Read OMS settings from shop metafield.
 */
export async function getSettings(
  shop: string,
  accessToken: string
): Promise<OmsSettings | null> {
  const client = new shopify.clients.Graphql({ session: { shop, accessToken } as never });

  const response = await client.request(`
    {
      shop {
        metafield(namespace: "${NAMESPACE}", key: "${SETTINGS_KEY}") {
          value
        }
      }
    }
  `);

  const metafield = (response.data as { shop: { metafield: { value: string } | null } }).shop.metafield;
  if (!metafield) return null;

  try {
    return JSON.parse(metafield.value);
  } catch {
    return null;
  }
}

/**
 * Save OMS settings to shop metafield.
 */
export async function saveSettings(
  shop: string,
  accessToken: string,
  settings: OmsSettings
): Promise<void> {
  const client = new shopify.clients.Graphql({ session: { shop, accessToken } as never });

  await client.request(`
    mutation {
      metafieldsSet(metafields: [{
        namespace: "${NAMESPACE}"
        key: "${SETTINGS_KEY}"
        type: "json"
        value: ${JSON.stringify(JSON.stringify(settings))}
        ownerId: "gid://shopify/Shop"
      }]) {
        metafields { id }
        userErrors { field message }
      }
    }
  `);
}
