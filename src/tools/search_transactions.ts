import { lookupPrefecture, lookupCity, lookupPropertyType, getCitiesByPrefecture } from "../data/area_codes";
import { fetchTransactions, getRecentQuarters, parseWalkMinutes, RawTransaction } from "../utils/api_client";
import { getFromCache, setToCache, buildCacheKey } from "../cache/kv_cache";

export const searchTransactionsDefinition = {
  name: "search_transactions",
  description:
    "Search real estate transaction records in Japan by area and property type. " +
    "Returns individual transaction cases with price, area, and location details. " +
    "Data source: MLIT Real Estate Information Library API (XIT001). " +
    "Example: prefecture='東京都', city='渋谷区', type='マンション'",
  inputSchema: {
    type: "object" as const,
    properties: {
      prefecture: {
        type: "string",
        description: "Prefecture name in Japanese (e.g. '東京都', '北海道', '大阪府')",
      },
      city: {
        type: "string",
        description: "City or ward name in Japanese (e.g. '渋谷区', '札幌市中央区', '横浜市西区')",
      },
      type: {
        type: "string",
        description: "Property type in Japanese: 'マンション', '土地', '一戸建て', '農地', '林地'. Omit for all types.",
      },
      year: {
        type: "number",
        description: "Target year (e.g. 2024). Omit to use the most recent 4 quarters.",
      },
    },
    required: ["prefecture", "city"],
  },
};

export interface TransactionResult {
  trade_price: number;
  area: number | null;
  price_per_sqm: number | null;
  period: string;
  type: string;
  district: string | null;
  nearest_station: string | null;
  walk_minutes: number | null;
  building_year: string | null;
  floor_plan: string | null;
  structure: string | null;
}

function toTransactionResult(raw: RawTransaction): TransactionResult {
  const tradePrice = parseInt(raw.TradePrice, 10) || 0;
  const area = raw.Area ? parseFloat(raw.Area) : null;
  const unitPrice = raw.UnitPrice ? parseInt(raw.UnitPrice, 10) : null;
  const pricePerSqm = unitPrice ?? (area && area > 0 ? Math.round(tradePrice / area) : null);

  return {
    trade_price: tradePrice,
    area: area,
    price_per_sqm: pricePerSqm,
    period: raw.Period,
    type: raw.Type,
    district: raw.DistrictName || null,
    nearest_station: raw.NearestStation || null,
    walk_minutes: parseWalkMinutes(raw.TimeToNearestStation),
    building_year: raw.BuildingYear || null,
    floor_plan: raw.FloorPlan || null,
    structure: raw.Structure || null,
  };
}

export async function handleSearchTransactions(
  args: { prefecture: string; city: string; type?: string; year?: number },
  env: { REALESTATE_CACHE: KVNamespace; REALESTATE_API_KEY: string }
): Promise<string> {
  const prefInfo = lookupPrefecture(args.prefecture);
  if (!prefInfo) {
    const allPrefs = ["北海道", "東京都", "大阪府", "神奈川県", "愛知県", "福岡県", "その他全47都道府県"];
    return JSON.stringify({
      error: "PREFECTURE_NOT_FOUND",
      message: `「${args.prefecture}」は対応していない都道府県名です。get_supported_areas ツールで対応エリアの一覧を確認してください。`,
      examples: allPrefs,
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

  const quarters = getRecentQuarters(args.year);

  const cacheKey = buildCacheKey({
    prefecture: prefInfo.code,
    city: cityInfo.code,
    type: propertyTypeCode ?? undefined,
    year: args.year,
  });

  const cached = await getFromCache<TransactionResult[]>(env.REALESTATE_CACHE, cacheKey);
  if (cached) {
    return JSON.stringify({
      prefecture: prefInfo.name,
      city: cityInfo.name,
      type_filter: args.type ?? null,
      count: cached.length,
      transactions: cached,
      cached: true,
    }, null, 2);
  }

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

  const transactions = allRaw
    .filter((r) => parseInt(r.TradePrice, 10) > 0)
    .map(toTransactionResult)
    .sort((a, b) => b.trade_price - a.trade_price);

  await setToCache(env.REALESTATE_CACHE, cacheKey, transactions);

  return JSON.stringify({
    prefecture: prefInfo.name,
    city: cityInfo.name,
    type_filter: args.type ?? null,
    count: transactions.length,
    transactions,
    cached: false,
  }, null, 2);
}
