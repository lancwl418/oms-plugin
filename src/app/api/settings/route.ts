import { NextRequest, NextResponse } from "next/server";
import { authenticateApi } from "@/lib/shopify/verify";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/settings — read store settings from DB.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const settings = auth.store.settings;
  if (!settings) return NextResponse.json({});

  return NextResponse.json({
    ...settings,
    omsApiToken: settings.omsApiToken
      ? `${settings.omsApiToken.slice(0, 8)}...`
      : null,
    hasOmsToken: !!settings.omsApiToken,
  });
}

/**
 * PUT /api/settings — update store settings in DB.
 */
export async function PUT(req: NextRequest) {
  const auth = await authenticateApi(req);
  if (auth.error) return auth.error;

  const body = await req.json();

  // Filter out undefined/null values
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null && value !== "") {
      updateData[key] = value;
    }
  }

  const settings = await prisma.storeSettings.upsert({
    where: { storeId: auth.store.id },
    update: updateData,
    create: { storeId: auth.store.id, ...updateData },
  });

  return NextResponse.json({
    success: true,
    hasOmsToken: !!settings.omsApiToken,
  });
}
