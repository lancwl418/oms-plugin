import type { StoreSettings } from "@prisma/client";
import type {
  EccangOrderParams,
  EccangConsigneeShipper,
  EccangBox,
  EccangGoods,
} from "./types";

export interface ShippingAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  province_code?: string;
  country_code?: string;
  zip?: string;
  phone?: string;
}

export interface PackageInfo {
  weightLbs: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}

export interface OrderForLabel {
  orderNumber: string;
  customerName?: string | null;
  customerEmail?: string | null;
  shippingAddress: ShippingAddress;
  totalPrice: number;
  currency: string;
}

/**
 * Maps order + store settings to EccangTMS order params.
 * Shipper info comes from StoreSettings (per-merchant config).
 */
export function mapOrderToEccangParams(
  order: OrderForLabel,
  settings: StoreSettings,
  productCode: string,
  pkg: PackageInfo
): EccangOrderParams {
  const addr = order.shippingAddress;
  const orderNumber = order.orderNumber.replace("#", "");

  const recipientName =
    `${addr.first_name || ""} ${addr.last_name || ""}`.trim() ||
    order.customerName ||
    "";

  const consigneeShipper: EccangConsigneeShipper = {
    // Consignee (recipient)
    consigneeName: `${recipientName}-${orderNumber}`,
    consigneeCompanyName: addr.company || "",
    consigneeCountryCode: addr.country_code || "US",
    consigneeStateOrProvince: addr.province_code || addr.province || "",
    consigneeCity: addr.city || "",
    consigneeAddress1: addr.address1 || "",
    consigneeAddress2: addr.address2 || "",
    consigneePostCode: addr.zip || "",
    consigneePhone: addr.phone || "",
    consigneeEmail: order.customerEmail || "",
    // Shipper (from merchant's store settings)
    shipperName: settings.shipperName || "",
    shipperCompanyName: settings.shipperCompanyName || "",
    shipperCountryCode: settings.shipperCountryCode || "US",
    shipperStateOrProvince: settings.shipperState || "",
    shipperCity: settings.shipperCity || "",
    shipperAddress1: settings.shipperAddress1 || "",
    shipperAddress2: settings.shipperAddress2 || "",
    shipperPostCode: settings.shipperPostCode || "",
    shipperPhone: settings.shipperPhone || "",
    shipperEmail: settings.shipperEmail || "",
  };

  const boxNo = "BOX001";

  const boxList: EccangBox[] = [
    {
      boxNo,
      boxWeight: pkg.weightLbs,
      boxLength: pkg.lengthIn,
      boxWidth: pkg.widthIn,
      boxHeight: pkg.heightIn,
    },
  ];

  const goodsList: EccangGoods[] = [
    {
      goodsName: "merchandise",
      goodsNameEn: "merchandise",
      declareUnit: "box",
      quantity: 1,
      value: order.totalPrice || 10,
      weight: pkg.weightLbs,
      sku: "ITEM",
      boxNo,
    },
  ];

  return {
    productCode,
    customerNo: orderNumber,
    goodsType: 3,
    orderWeight: pkg.weightLbs,
    weightSizeUnit: 2, // imperial (in/lb)
    currencyCode: order.currency || "USD",
    async: 0,
    signatureService: "NO",
    sameCustomerNoHandler: "return_last_successful_data",
    consigneeShipper,
    boxList,
    goodsList,
  };
}
