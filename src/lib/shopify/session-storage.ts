import { Session } from "@shopify/shopify-api";
import { prisma } from "@/lib/prisma";

/**
 * Prisma-based session storage for Shopify OAuth.
 * Implements the SessionStorage interface expected by @shopify/shopify-api.
 */
export const sessionStorage = {
  async storeSession(session: Session): Promise<boolean> {
    await prisma.session.upsert({
      where: { id: session.id },
      update: {
        shop: session.shop,
        state: session.state || "",
        isOnline: session.isOnline || false,
        scope: session.scope,
        expires: session.expires,
        accessToken: session.accessToken,
        userId: session.onlineAccessInfo?.associated_user?.id
          ? BigInt(session.onlineAccessInfo.associated_user.id)
          : null,
      },
      create: {
        id: session.id,
        shop: session.shop,
        state: session.state || "",
        isOnline: session.isOnline || false,
        scope: session.scope,
        expires: session.expires,
        accessToken: session.accessToken,
        userId: session.onlineAccessInfo?.associated_user?.id
          ? BigInt(session.onlineAccessInfo.associated_user.id)
          : null,
      },
    });
    return true;
  },

  async loadSession(id: string): Promise<Session | undefined> {
    const row = await prisma.session.findUnique({ where: { id } });
    if (!row) return undefined;

    const session = new Session({
      id: row.id,
      shop: row.shop,
      state: row.state,
      isOnline: row.isOnline,
    });
    session.scope = row.scope || undefined;
    session.expires = row.expires || undefined;
    session.accessToken = row.accessToken || undefined;
    return session;
  },

  async deleteSession(id: string): Promise<boolean> {
    try {
      await prisma.session.delete({ where: { id } });
    } catch {
      // Already deleted
    }
    return true;
  },

  async deleteSessions(ids: string[]): Promise<boolean> {
    await prisma.session.deleteMany({ where: { id: { in: ids } } });
    return true;
  },

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const rows = await prisma.session.findMany({ where: { shop } });
    return rows.map((row) => {
      const session = new Session({
        id: row.id,
        shop: row.shop,
        state: row.state,
        isOnline: row.isOnline,
      });
      session.scope = row.scope || undefined;
      session.expires = row.expires || undefined;
      session.accessToken = row.accessToken || undefined;
      return session;
    });
  },
};
