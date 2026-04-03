import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  Divider,
  NumberField,
  Select,
} from "@shopify/ui-extensions-react/admin";
import { useState, useEffect, useCallback } from "react";

interface Estimate {
  productCode: string;
  productName: string;
  totalPrice: number;
  currencyCode: string;
  chargedWeight: number;
}

interface ShipmentInfo {
  omsOrderNo: string;
  trackingNumber: string | null;
  status: string;
  productName: string;
  shippingCost: number;
}

type ViewState = "idle" | "loading" | "estimate" | "pushed" | "tracking" | "error";

function Extension() {
  const { data, auth } = useApi<"admin.order-details.block.render">();
  const orderId = data.selected?.[0]?.id;

  const [view, setView] = useState<ViewState>("idle");
  const [error, setError] = useState("");
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [shipment, setShipment] = useState<ShipmentInfo | null>(null);
  const [trackingInfo, setTrackingInfo] = useState<Record<string, unknown> | null>(null);

  // Package info
  const [weight, setWeight] = useState(1);
  const [length, setLength] = useState(12);
  const [width, setWidth] = useState(10);
  const [height, setHeight] = useState(3);

  const apiCall = useCallback(async (path: string, options: RequestInit = {}) => {
    const token = await auth.idToken();
    if (!token) {
      throw new Error("Could not get session token");
    }
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    return res.json();
  }, [auth]);

  function getPackageInfo() {
    return {
      weightLbs: weight || 1,
      lengthIn: length || 12,
      widthIn: width || 10,
      heightIn: height || 3,
    };
  }

  // Check if order already has a shipment
  useEffect(() => {
    if (!orderId) return;
    apiCall("/oms/track", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }).then((result) => {
      if (result.success && result.trackingNumber) {
        setShipment({
          omsOrderNo: "",
          trackingNumber: result.trackingNumber,
          status: result.mappedStatus || "unknown",
          productName: "",
          shippingCost: 0,
        });
        setTrackingInfo(result.tracking || null);
        setView("tracking");
      }
    }).catch(() => {
      // No existing shipment — stay on idle
    });
  }, [orderId, apiCall]);

  async function handleEstimate() {
    setView("loading");
    setError("");
    try {
      const result = await apiCall("/oms/estimate", {
        method: "POST",
        body: JSON.stringify({ orderId, packageInfo: getPackageInfo() }),
      });

      if (result.error) {
        setError(result.error);
        setView("error");
        return;
      }

      setEstimates(result);
      if (result.length > 0) {
        setSelectedProduct(result[0].productCode);
      }
      setView("estimate");
    } catch {
      setError("Failed to get estimates");
      setView("error");
    }
  }

  async function handlePush() {
    if (!selectedProduct) return;
    setView("loading");
    setError("");
    try {
      const result = await apiCall("/oms/push", {
        method: "POST",
        body: JSON.stringify({
          orderId,
          productCode: selectedProduct,
          packageInfo: getPackageInfo(),
        }),
      });

      if (result.error) {
        setError(result.error);
        setView("error");
        return;
      }

      setShipment({
        omsOrderNo: result.orderNo,
        trackingNumber: result.serverNo,
        status: "label_created",
        productName: result.productName,
        shippingCost: result.totalPrice,
      });
      setView("pushed");
    } catch {
      setError("Failed to create label");
      setView("error");
    }
  }

  async function handleRefreshTracking() {
    setView("loading");
    try {
      const result = await apiCall("/oms/track", {
        method: "POST",
        body: JSON.stringify({ orderId }),
      });

      if (result.success && result.trackingNumber) {
        setShipment((prev) =>
          prev
            ? { ...prev, trackingNumber: result.trackingNumber, status: result.mappedStatus || prev.status }
            : prev
        );
        setTrackingInfo(result.tracking || null);
        setView("tracking");
      } else {
        setView("pushed");
      }
    } catch {
      setView("pushed");
    }
  }

  // ─── Render ────────────────────────────────────

  if (!orderId) {
    return (
      <AdminBlock title="OMS Label">
        <Text>No order selected.</Text>
      </AdminBlock>
    );
  }

  return (
    <AdminBlock title="OMS Label">
      <BlockStack gap="base">
        {/* Error Banner */}
        {view === "error" && (
          <Banner tone="critical" title={error} />
        )}

        {/* Loading */}
        {view === "loading" && <Text>Loading...</Text>}

        {/* Idle — show package info and estimate button */}
        {(view === "idle" || view === "error") && (
          <>
            <Text fontWeight="bold">Package Dimensions</Text>
            <InlineStack gap="base">
              <NumberField
                label="Weight (lbs)"
                value={weight}
                onChange={setWeight}
              />
              <NumberField
                label="Length (in)"
                value={length}
                onChange={setLength}
              />
              <NumberField
                label="Width (in)"
                value={width}
                onChange={setWidth}
              />
              <NumberField
                label="Height (in)"
                value={height}
                onChange={setHeight}
              />
            </InlineStack>
            <Button onPress={handleEstimate}>Get Shipping Estimates</Button>
          </>
        )}

        {/* Estimates — show options and create label button */}
        {view === "estimate" && (
          <>
            <Text fontWeight="bold">Shipping Options</Text>
            <Select
              label="Select shipping product"
              value={selectedProduct}
              onChange={setSelectedProduct}
              options={estimates.map((est) => ({
                value: est.productCode,
                label: `${est.productName} — $${est.totalPrice.toFixed(2)} ${est.currencyCode} (${est.chargedWeight} lbs)`,
              }))}
            />
            <Divider />
            <InlineStack gap="base">
              <Button onPress={() => setView("idle")}>Back</Button>
              <Button onPress={handlePush} variant="primary">
                Create Label
              </Button>
            </InlineStack>
          </>
        )}

        {/* Pushed — label created */}
        {view === "pushed" && shipment && (
          <>
            <Banner tone="success" title="Label Created" />
            <BlockStack gap="small">
              <Text>Product: {shipment.productName}</Text>
              <Text>Cost: ${shipment.shippingCost.toFixed(2)}</Text>
              <Text>Order No: {shipment.omsOrderNo}</Text>
              {shipment.trackingNumber && (
                <Text>Tracking: {shipment.trackingNumber}</Text>
              )}
            </BlockStack>
            <Button onPress={handleRefreshTracking}>Refresh Tracking</Button>
          </>
        )}

        {/* Tracking — show tracking details */}
        {view === "tracking" && shipment && (
          <>
            <Banner
              tone={shipment.status === "delivered" ? "success" : "info"}
              title={`Status: ${shipment.status.replace(/_/g, " ").toUpperCase()}`}
            />
            {shipment.trackingNumber && (
              <Text>Tracking: {shipment.trackingNumber}</Text>
            )}
            {trackingInfo && (trackingInfo as { fromDetail?: unknown[] }).fromDetail && (
              <BlockStack gap="small">
                <Text fontWeight="bold">Tracking History</Text>
                {((trackingInfo as { fromDetail: Array<{ trackTime: string; trackDescription: string }> }).fromDetail || [])
                  .slice(0, 5)
                  .map((event, i) => (
                    <Text key={i}>
                      {event.trackTime} — {event.trackDescription}
                    </Text>
                  ))}
              </BlockStack>
            )}
            <Button onPress={handleRefreshTracking}>Refresh</Button>
          </>
        )}
      </BlockStack>
    </AdminBlock>
  );
}

export default reactExtension(
  "admin.order-details.block.render",
  () => <Extension />
);
