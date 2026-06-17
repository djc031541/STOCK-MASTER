import { prisma } from "@/lib/prisma";

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const row = await prisma.dataCache.findUnique({ where: { key } });
    if (!row || row.expiresAt.getTime() <= Date.now()) return null;
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, data: unknown, ttlMs: number) {
  try {
    await prisma.dataCache.upsert({
      where: { key },
      update: {
        payload: JSON.stringify(data),
        expiresAt: new Date(Date.now() + ttlMs),
      },
      create: {
        key,
        payload: JSON.stringify(data),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
  } catch {
    // Cache writes must never break market data reads.
  }
}

