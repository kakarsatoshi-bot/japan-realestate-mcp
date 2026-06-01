const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7日間

export async function getFromCache<T>(
  kv: KVNamespace,
  key: string
): Promise<T | null> {
  const cached = await kv.get(key, "json");
  return cached as T | null;
}

export async function setToCache<T>(
  kv: KVNamespace,
  key: string,
  value: T
): Promise<void> {
  await kv.put(key, JSON.stringify(value), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
}

export function buildCacheKey(params: Record<string, string | number | undefined>): string {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `realestate:${sorted}`;
}
