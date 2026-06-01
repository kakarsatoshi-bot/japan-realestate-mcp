import { PREFECTURES, getCitiesByPrefecture, lookupPrefecture } from "../data/area_codes";

export const getSupportedAreasDefinition = {
  name: "get_supported_areas",
  description:
    "Returns the list of supported prefectures and major cities for Japan real estate search. " +
    "If prefecture is specified (e.g. '東京都'), returns the list of supported cities in that prefecture. " +
    "If omitted, returns all 47 prefectures.",
  inputSchema: {
    type: "object" as const,
    properties: {
      prefecture: {
        type: "string",
        description: "Prefecture name in Japanese (e.g. '東京都', '大阪府'). Omit to get all prefectures.",
      },
    },
    required: [],
  },
};

export async function handleGetSupportedAreas(args: {
  prefecture?: string;
}): Promise<string> {
  if (!args.prefecture) {
    return JSON.stringify({
      supported_prefectures: PREFECTURES.map((p) => ({
        code: p.code,
        name: p.name,
      })),
      total: PREFECTURES.length,
      note: "To get cities in a prefecture, call get_supported_areas with the prefecture name.",
    }, null, 2);
  }

  const prefInfo = lookupPrefecture(args.prefecture);
  if (!prefInfo) {
    return JSON.stringify({
      error: "PREFECTURE_NOT_FOUND",
      message: `「${args.prefecture}」は対応していない都道府県名です。get_supported_areas ツール（引数なし）で全都道府県の一覧を確認してください。`,
    }, null, 2);
  }

  const cities = getCitiesByPrefecture(prefInfo.code);
  return JSON.stringify({
    prefecture: prefInfo.name,
    prefecture_code: prefInfo.code,
    supported_cities: cities.map((c) => ({
      code: c.code,
      name: c.name,
    })),
    total: cities.length,
  }, null, 2);
}
