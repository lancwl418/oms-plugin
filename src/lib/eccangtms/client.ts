import type {
  EccangResponse,
  EccangProduct,
  EccangOrderParams,
  EccangOrderResult,
  EccangEstimateResult,
  EccangTrackDetail,
  EccangTrackingNumber,
} from "./types";

/**
 * Multi-tenant EccangTMS client.
 * Each store has its own apiToken and optional baseUrl.
 */
export interface OmsCredentials {
  apiToken: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://api.saas.eccangtms.com";

async function post<T>(
  creds: OmsCredentials,
  endpoint: string,
  body: Record<string, unknown>
): Promise<EccangResponse<T>> {
  const baseUrl = creds.baseUrl || DEFAULT_BASE_URL;
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiToken: creds.apiToken, ...body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EccangTMS HTTP ${res.status}: ${text}`);
  }

  const data: EccangResponse<T> = await res.json();
  if (!data.success || data.code !== 1) {
    throw new Error(
      `EccangTMS [${data.code}]: ${data.message || "Unknown error"}`
    );
  }

  return data;
}

/** Get available shipping products */
export async function listProducts(
  creds: OmsCredentials
): Promise<EccangProduct[]> {
  const data = await post<EccangProduct[]>(creds, "/open-api/product/list", {});
  return data.result;
}

/** Estimate shipping cost */
export async function calculateShipping(
  creds: OmsCredentials,
  params: Omit<EccangOrderParams, "apiToken" | "async" | "sameCustomerNoHandler">
): Promise<EccangEstimateResult[]> {
  const data = await post<EccangEstimateResult[]>(
    creds,
    "/open-api/order/calculate",
    params as Record<string, unknown>
  );
  return data.result;
}

/** Create a shipping order (get label) */
export async function createOrder(
  creds: OmsCredentials,
  params: Omit<EccangOrderParams, "apiToken">
): Promise<EccangOrderResult> {
  const data = await post<EccangOrderResult>(
    creds,
    "/open-api/order/create",
    params as Record<string, unknown>
  );
  return data.result;
}

/** Get tracking details by serverNos */
export async function getTrackDetails(
  creds: OmsCredentials,
  serverNos: string[]
): Promise<EccangTrackDetail[]> {
  const data = await post<EccangTrackDetail[]>(
    creds,
    "/open-api/order/getTrackDetails",
    { serverNos }
  );
  return data.result;
}

/** Get tracking numbers by orderNo */
export async function getTrackingNumber(
  creds: OmsCredentials,
  orderNo: string
): Promise<EccangTrackingNumber[]> {
  const data = await post<EccangTrackingNumber[]>(
    creds,
    "/open-api/order/getTrackingNumber",
    { orderNo }
  );
  return data.result;
}
