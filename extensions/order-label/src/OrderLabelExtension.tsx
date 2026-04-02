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
  TextField,
  Select,
} from "@shopify/ui-extensions-react/admin";
import { useState, useEffect } from "react";

interface Product {
  code: string;
  name: string;
}

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
  const { data, sessionToken } = useApi<"admin.order-details.block.render">();
  const orderId = data.selected?.[0]?.id;

  const [view, setView] = useState<ViewState>("idle");
  const [error, setError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [shipment, setShipment] = useState<ShipmentInfo | null>(null);
  const [trackingInfo, setTrackingInfo] = useState<Record<string, unknown> | null>(null);

  // Package info
  const [weight, setWeight] = useState("1");
  const [length, setLength] = useState("12");
  const [width, setWidth] = useState("10");
  const [height, setHeight] = useState("3");

  async function apiCall(path: string, options: RequestInit = {}) {
    const token = await sessionToken.get();
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    return res.json();
  }

  function getPackageInfo() {
    return {
      weightLbs: parseFloat(weight) || 1,
      lengthIn: parseFloat(length) || 12,
      widthIn: parseFloat(width) || 10,
      heightIn: parseFloat(height) || 3,
    };
  }

  // Check if order already has a shipment
  useEffect(() => {
    if (!orderId) return;
    checkExistingShipment();
  }, [orderId]);

  async function checkExistingShipment() {
    try {
      const result = await apiCall("/oms/track", {
        method: "POST",
        body: JSON.stringify({ orderId }),
      });
      if (result.success && result.tracking) {
        setShipment({
          omsOrderNo: "",
          trackingNumber: result.trackingNumber,
          status: result.mappedStatus,
          productName: "",
          shippingCost: 0,
        });
        setTrackingInfo(result.tracking);
        setView("tracking");
      }
    } catch {
      // No existing shipment — stay on idle
    }
  }

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
    } catch (e) {
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
        omsOrderNo: result.omsOrder.orderNo,
        trackingNumber: result.omsOrder.serverNo,
        status: "label_created",
        productName: result.omsOrder.productName,
        shippingCost: result.omsOrder.totalPrice,
      });
      setView("pushed");
    } catch (e) {
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

      if (result.success) {
        setTrackingInfo(result.tracking || null);
        if (result.trackingNumber) {
          setShipment((prev) =>
            prev
              ? { ...prev, trackingNumber: result.trackingNumber, status: result.mappedStatus }
              : prev
          );
        }
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
          <Banner status="critical" title="Error">
            <Text>{error}</Text>
          </Banner>
        )}

        {/* Loading */}
        {view === "loading" && <Text>Loading...</Text>}

        {/* Idle — show package info and estimate button */}
        {(view === "idle" || view === "error") && (
          <>
            <Text fontWeight="bold">Package Dimensions</Text>
            <InlineStack gap="base">
              <TextField
                label="Weight (lbs)"
                value={weight}
                onChange={setWeight}
                type="number"
              />
              <TextField
                label="Length (in)"
                value={length}
                onChange={setLength}
                type="number"
              />
              <TextField
                label="Width (in)"
                value={width}
                onChange={setWidth}
                type="number"
              />
              <TextField
                label="Height (in)"
                value={height}
                onChange={setHeight}
                type="number"
              />
            </InlineStack>
            <Button onPress={handleEstimate}>Get Shipping Estimates</Button>
          </>
        )}

        {/* Estimates — show options and create label button */}
        {view === "estimate" && (
          <>
            <Text fontWeight="bold">Shipping Options</Text>
            {estimates.map((est) => (
              <InlineStack key={est.productCode} gap="base" blockAlignment="center">
                <input
                  type="radio"
                  name="product"
                  checked={selectedProduct === est.productCode}
                  onChange={() => setSelectedProduct(est.productCode)}
                />
                <BlockStack gap="extraTight">
                  <Text fontWeight="semibold">{est.productName}</Text>
                  <Text>
                    ${est.totalPrice.toFixed(2)} {est.currencyCode} — {est.chargedWeight} lbs
                  </Text>
                </BlockStack>
              </InlineStack>
            ))}
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
            <Banner status="success" title="Label Created">
              <BlockStack gap="extraTight">
                <Text>Product: {shipment.productName}</Text>
                <Text>Cost: ${shipment.shippingCost.toFixed(2)}</Text>
                <Text>Order No: {shipment.omsOrderNo}</Text>
                {shipment.trackingNumber && (
                  <Text>Tracking: {shipment.trackingNumber}</Text>
                )}
              </BlockStack>
            </Banner>
            <Button onPress={handleRefreshTracking}>Refresh Tracking</Button>
          </>
        )}

        {/* Tracking — show tracking details */}
        {view === "tracking" && shipment && (
          <>
            <Banner
              status={shipment.status === "delivered" ? "success" : "info"}
              title={`Status: ${shipment.status.replace(/_/g, " ").toUpperCase()}`}
            >
              <BlockStack gap="extraTight">
                {shipment.trackingNumber && (
                  <Text>Tracking: {shipment.trackingNumber}</Text>
                )}
              </BlockStack>
            </Banner>
            {trackingInfo && (trackingInfo as { fromDetail?: unknown[] }).fromDetail && (
              <BlockStack gap="extraTight">
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
