# Shopify OMS Label

Shopify embedded app that integrates EccangTMS (OMS) shipping into Shopify order management. Merchants can estimate shipping costs, create labels, track shipments, and auto-push fulfillments back to Shopify — all from the order details page.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Database**: PostgreSQL (Supabase) via Prisma ORM
- **Frontend Extension**: Shopify Admin UI Extension (React)
- **Validation**: Zod
- **External API**: EccangTMS (shipping/logistics)
- **Shopify CLI**: `@shopify/cli` for dev/deploy

## Project Structure

```
src/
  app/
    api/
      auth/           # Shopify OAuth (install + callback)
      oms/
        estimate/     # POST — estimate shipping cost for an order
        push/         # POST — create shipping label via EccangTMS
        track/        # POST — get tracking info, optionally auto-fulfill
        products/     # GET — list available shipping products
        fulfill/      # POST — manual fulfillment push to Shopify
      settings/       # GET/POST — store settings CRUD
    settings/page.tsx # Settings UI page
    page.tsx          # App home page
  lib/
    eccangtms/        # EccangTMS API client, types, and order mapper
    shopify/          # Shopify auth, config, session storage, order/fulfillment helpers
    prisma.ts         # Prisma client singleton
extensions/
  order-label/        # Shopify Admin UI Extension (order details block)
prisma/
  schema.prisma       # Store, StoreSettings, Session models
```

## Key Concepts

- **Multi-tenant**: Each installed store gets its own `Store` + `StoreSettings` record with OMS credentials and shipper info.
- **Auth flow**: Shopify OAuth → store access token saved in DB. API routes authenticate via `authenticateApi()` which verifies the Shopify session token.
- **OMS integration**: The `eccangtms/client.ts` wraps the EccangTMS REST API. Credentials come from `StoreSettings.omsApiToken`.
- **Order mapping**: `eccangtms/mapper.ts` converts Shopify order data to EccangTMS order params (address, items, dimensions).
- **Fulfillment sync**: Track endpoint can auto-push tracking numbers back to Shopify as fulfillments via `pushFulfillmentToShopify()`.

## Commands

```bash
npm run dev            # Start Next.js dev server
npm run build          # Build for production
npm run shopify:dev    # Start Shopify app dev (tunnel + extension)
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database (no migration)
npm run db:migrate     # Create and apply migration
```

## Environment Variables

Required in `.env`:
- `DATABASE_URL` — PostgreSQL connection string
- `SHOPIFY_API_KEY` — Shopify app API key
- `SHOPIFY_API_SECRET` — Shopify app secret
- `SHOPIFY_SCOPES` — OAuth scopes
- `SHOPIFY_APP_URL` — App URL (localhost in dev)

## Shopify API Version

Using `2025-01`. Scopes: `read_orders, write_orders, read_fulfillments, write_fulfillments, read_shipping, write_shipping`.

## Extension

The `order-label` extension renders an `AdminBlock` on the order details page. Flow:
1. Enter package dimensions
2. Get shipping estimates (calls `/api/oms/estimate`)
3. Select a product and create label (calls `/api/oms/push`)
4. View tracking status (calls `/api/oms/track`)
