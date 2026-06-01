import { lookupPrefecture, lookupCity, lookupPropertyType, getCitiesByPrefecture } from "../data/area_codes";
import { fetchTransactions, getRecentQuarters, RawTransaction } from "../utils/api_client";
import { getFromCache, setToCache, buildCacheKey } from "../cache/kv_cache";

export const getPriceSummaryDefinition = {
  name: "get_price_summary",
  description:
    "Returns statistical price summary (average, median, min, max, price per sqm) " +
    "for real estate transactions in a specified area. " +
    "Covers the most recent 4 quarters of MLIT transaction data. " +
    "Example: prefecture='東京都', city='港区', type='マンション'",
  inputSchema: {
    type: "object" as const,
    properties: {
      prefecture: {
        type: "string",
        description: "Prefecture name in Japanese (e.g. '東京都', '大阪府')",
      },
      city: {
        type: "string",
        description: "City or ward name in Japanese (e.g. '港区', '大阪市中央区')",
      },
      type: {
        type: "string",
        description: "Property type: 'マンション', '土地', '一戸建て', '農地', '林地'. Omit for all types.",
      },
    },
    required: ["prefecture", "city"],
  },
};

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export async function handleGetPriceSummary(
  args: { prefecture: string; city: string; type?: string },
  env: { REALESTATE_CACHE: KVNamespace; REALESTATE_API_KEY: string }
): Promise<string> {
  const prefInfo = lookupPrefecture(args.prefecture);
  if (!prefInfo) {
    return JSON.stringify({
      error: "PREFECTURE_NOT_FOUND",
      message: `「${args.prefecture}」は対応していない都道府県名です。get_supported_areas ツールで対応エリアを確認してください。`,
    }, null, 2);
  }

  const cityInfo = lookupCity(prefInfo.code, args.city);
  if (!cityInfo) {
    const cities = getCitiesByPrefecture(prefInfo.code);
    return JSON.stringify({
      error: "CITY_NOT_FOUND",
      message: `「${args.city}」は${prefInfo.name}の対応市区町村にありません。get_supported_areas ツールで対応エリアを確認してください。`,
      supported_cities_in_prefecture: cities.map((c) => c.name),
    }, null, 2);
  }

  const propertyTypeCode = args.type ? lookupPropertyType(args.type) : undefined;
  if (args.type && !propertyTypeCode) {
    return JSON.stringify({
      error: "INVALID_PROPERTY_TYPE",
      message: `「${args.type}」は対応していない物件種別です。`,
      supported_types: ["マンション", "土地", "一戸建て", "農地", "林地"],
    }, null, 2);
  }

  const cacheKey = buildCacheKey({
    summary: "1",
    prefecture: prefInfo.code,
    city: cityInfo.code,
    type: propertyTypeCode ?? undefined,
  });

  const cached = await getFromCache<object>(env.REALESTATE_CACHE, cacheKey);
  if (cached) {
    return JSON.stringify({ ...cached, cached: true }, null, 2);
  }

  const quarters = getRecentQuarters();
  const allRaw: RawTransaction[] = [];

  for (const q of quarters) {
    const result = await fetchTransactions(env.REALESTATE_API_KEY, {
      year: q.year,
      quarter: q.quarter,
      area: prefInfo.code,
      city: cityInfo.code,
      type: propertyTypeCode ?? undefined,
    });

    if (!result.ok) {
      return JSON.stringify({
        error: result.error,
        message: result.message,
      }, null, 2);
    }

    allRaw.push(...result.data);
  }

  const prices = allRaw
    .map((r) => parseInt(r.TradePrice, 10))
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  const unitPrices = allRaw
    .filter((r) => r.UnitPrice && parseInt(r.UnitPrice, 10) > 0)
    .map((r) => parseInt(r.UnitPrice!, 10))
    .filter((p) => p > 0);

  if (prices.length === 0) {
    return JSON.stringify({
      error: "NO_DATA",
      message: `${prefInfo.name}${cityInfo.name}（${args.type ?? "全種別"}）の取引データが見つかりませんでした。対象期間または物件種別を変えてお試しください。`,
      prefecture: prefInfo.name,
      city: cityInfo.name,
      type_filter: args.type ?? null,
    }, null, 2);
  }

  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const medianPrice = median(prices);
  const avgUnitPrice = unitPrices.length > 0
    ? Math.round(unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length)
    : null;

  const oldestQ = quarters[quarters.length - 1];
  const newestQ = quarters[0];
  const periodLabel = `${oldestQ.year}年第${oldestQ.quarter}四半期〜${newestQ.year}年第${newestQ.quarter}四半期`;

  const summary = {
    prefecture: prefInfo.name,
    city: cityInfo.name,
    type_filter: args.type ?? null,
    count: prices.length,
    avg_price: avgPrice,
    median_price: medianPrice,
    max_price: prices[prices.length - 1],
    min_price: prices[0],
    avg_price_per_sqm: avgUnitPrice,
    period: periodLabel,
  };

  await setToCache(env.REALESTATE_CACHE, cacheKey, summary);

  return JSON.stringify({ ...summary, cached: false }, null, 2);
}
