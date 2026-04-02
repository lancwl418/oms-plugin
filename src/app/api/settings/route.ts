import { NextRequest, NextResponse } from "next/server";
import { authenticateApi } from "@/lib/shopify/verify";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const settingsSchema = z.object({
  omsApiToken: z.string().optional(),
  omsBaseUrl: z.string().url().optional(),
  shipperName: z.string().optional(),
  shipperCompanyName: z.string().optional(),
  shipperCountryCode: z.string().max(2).optional(),
  shipperState: z.string().optional(),
  shipperCity: z.string().optional(),
  shipperAddress1: z.string().optional(),
  shipperAddress2: z.string().optional(),
  shipperPostCode: z.string().optional(),
  shipperPhone: z.string().optional(),
  shipperEmail: z.string().email().optional(),
  defaultWeightLbs: z.number().positive().optional(),
  defaultLengthIn: z.number().positive().optional(),
  defaultWidthIn: z.number().positive().optional(),
  defaultHeightIn: z.number().positive().optional(),
});

/**
 * GET /api/settings
 * Get current store settings.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const settings = auth.store.settings;
  if (!settings) {
    return NextResponse.json({});
  }

  // Don't expose the full API token — mask it
  return NextResponse.json({
    ...settings,
    omsApiToken: settings.omsApiToken
      ? `${settings.omsApiToken.slice(0, 8)}...${settings.omsApiToken.slice(-4)}`
      : null,
    hasOmsToken: !!settings.omsApiToken,
  });
}

/**
 * PUT /api/settings
 * Update store settings.
 */
export async function PUT(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Filter out undefined values
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updateData[key] = value;
    }
  }

  const settings = await prisma.storeSettings.upsert({
    where: { storeId: auth.store.id },
    update: updateData,
    create: {
      storeId: auth.store.id,
      ...updateData,
    },
  });

  return NextResponse.json({
    ...settings,
    omsApiToken: settings.omsApiToken
      ? `${settings.omsApiToken.slice(0, 8)}...${settings.omsApiToken.slice(-4)}`
      : null,
    hasOmsToken: !!settings.omsApiToken,
  });
}
