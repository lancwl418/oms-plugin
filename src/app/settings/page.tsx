"use client";

import { useState, useEffect, useCallback } from "react";

interface Settings {
  hasOmsToken: boolean;
  omsApiToken: string | null;
  omsBaseUrl: string;
  shipperName: string;
  shipperCompanyName: string;
  shipperCountryCode: string;
  shipperState: string;
  shipperCity: string;
  shipperAddress1: string;
  shipperAddress2: string;
  shipperPostCode: string;
  shipperPhone: string;
  shipperEmail: string;
  defaultWeightLbs: number | null;
  defaultLengthIn: number | null;
  defaultWidthIn: number | null;
  defaultHeightIn: number | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form state
  const [omsApiToken, setOmsApiToken] = useState("");
  const [shipperName, setShipperName] = useState("");
  const [shipperCompanyName, setShipperCompanyName] = useState("");
  const [shipperCountryCode, setShipperCountryCode] = useState("US");
  const [shipperState, setShipperState] = useState("");
  const [shipperCity, setShipperCity] = useState("");
  const [shipperAddress1, setShipperAddress1] = useState("");
  const [shipperAddress2, setShipperAddress2] = useState("");
  const [shipperPostCode, setShipperPostCode] = useState("");
  const [shipperPhone, setShipperPhone] = useState("");
  const [shipperEmail, setShipperEmail] = useState("");
  const [defaultWeightLbs, setDefaultWeightLbs] = useState("");
  const [defaultLengthIn, setDefaultLengthIn] = useState("");
  const [defaultWidthIn, setDefaultWidthIn] = useState("");
  const [defaultHeightIn, setDefaultHeightIn] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${await getSessionToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        // Populate form
        setShipperName(data.shipperName || "");
        setShipperCompanyName(data.shipperCompanyName || "");
        setShipperCountryCode(data.shipperCountryCode || "US");
        setShipperState(data.shipperState || "");
        setShipperCity(data.shipperCity || "");
        setShipperAddress1(data.shipperAddress1 || "");
        setShipperAddress2(data.shipperAddress2 || "");
        setShipperPostCode(data.shipperPostCode || "");
        setShipperPhone(data.shipperPhone || "");
        setShipperEmail(data.shipperEmail || "");
        setDefaultWeightLbs(data.defaultWeightLbs?.toString() || "");
        setDefaultLengthIn(data.defaultLengthIn?.toString() || "");
        setDefaultWidthIn(data.defaultWidthIn?.toString() || "");
        setDefaultHeightIn(data.defaultHeightIn?.toString() || "");
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    const body: Record<string, unknown> = {
      shipperName,
      shipperCompanyName,
      shipperCountryCode,
      shipperState,
      shipperCity,
      shipperAddress1,
      shipperAddress2,
      shipperPostCode,
      shipperPhone,
      shipperEmail,
    };

    // Only send token if user entered a new one
    if (omsApiToken) {
      body.omsApiToken = omsApiToken;
    }

    if (defaultWeightLbs) body.defaultWeightLbs = parseFloat(defaultWeightLbs);
    if (defaultLengthIn) body.defaultLengthIn = parseFloat(defaultLengthIn);
    if (defaultWidthIn) body.defaultWidthIn = parseFloat(defaultWidthIn);
    if (defaultHeightIn) body.defaultHeightIn = parseFloat(defaultHeightIn);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getSessionToken()}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved successfully!" });
        setOmsApiToken(""); // Clear token input
        fetchSettings();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading settings...</div>;
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        OMS Label Settings
      </h1>

      {message && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            borderRadius: 8,
            background: message.type === "success" ? "#d4edda" : "#f8d7da",
            color: message.type === "success" ? "#155724" : "#721c24",
          }}
        >
          {message.text}
        </div>
      )}

      {/* OMS API Token */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          OMS API Credentials
        </h2>
        <label style={{ display: "block", marginBottom: 8 }}>
          <span style={{ display: "block", fontWeight: 500, marginBottom: 4 }}>
            API Token {settings?.hasOmsToken && "(configured)"}
          </span>
          <input
            type="password"
            value={omsApiToken}
            onChange={(e) => setOmsApiToken(e.target.value)}
            placeholder={
              settings?.hasOmsToken
                ? "Enter new token to change"
                : "Enter your EccangTMS API token"
            }
            style={inputStyle}
          />
        </label>
      </section>

      {/* Shipper Info */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          Shipper Information (Sender)
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Name" value={shipperName} onChange={setShipperName} />
          <Field label="Company" value={shipperCompanyName} onChange={setShipperCompanyName} />
          <Field label="Address Line 1" value={shipperAddress1} onChange={setShipperAddress1} full />
          <Field label="Address Line 2" value={shipperAddress2} onChange={setShipperAddress2} full />
          <Field label="City" value={shipperCity} onChange={setShipperCity} />
          <Field label="State" value={shipperState} onChange={setShipperState} />
          <Field label="Zip Code" value={shipperPostCode} onChange={setShipperPostCode} />
          <Field label="Country" value={shipperCountryCode} onChange={setShipperCountryCode} />
          <Field label="Phone" value={shipperPhone} onChange={setShipperPhone} />
          <Field label="Email" value={shipperEmail} onChange={setShipperEmail} />
        </div>
      </section>

      {/* Default Package */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          Default Package Dimensions
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Weight (lbs)" value={defaultWeightLbs} onChange={setDefaultWeightLbs} type="number" />
          <Field label="Length (in)" value={defaultLengthIn} onChange={setDefaultLengthIn} type="number" />
          <Field label="Width (in)" value={defaultWidthIn} onChange={setDefaultWidthIn} type="number" />
          <Field label="Height (in)" value={defaultHeightIn} onChange={setDefaultHeightIn} type="number" />
        </div>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: "12px 24px",
          background: saving ? "#999" : "#008060",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 14,
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  full?: boolean;
}) {
  return (
    <label style={{ display: "block", ...(full ? { gridColumn: "1 / -1" } : {}) }}>
      <span style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: 14 }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

/**
 * Get Shopify session token from App Bridge.
 * In production this uses @shopify/app-bridge-react.
 * Placeholder for now.
 */
async function getSessionToken(): Promise<string> {
  // TODO: integrate with Shopify App Bridge
  // import { getSessionToken } from "@shopify/app-bridge-utils";
  return "";
}
