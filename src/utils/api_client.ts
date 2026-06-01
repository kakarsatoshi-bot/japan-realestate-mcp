const MLIT_API_ENDPOINT = "https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001";

export interface RawTransaction {
  Type: string;
  Region: string | null;
  MunicipalityCode: string;
  Prefecture: string;
  Municipality: string;
  DistrictName: string | null;
  TradePrice: string;
  PricePerUnit: string | null;
  FloorPlan: string | null;
  Area: string | null;
  UnitPrice: string | null;
  LandShape: string | null;
  Frontage: string | null;
  TotalFloorArea: string | null;
  BuildingYear: string | null;
  Structure: string | null;
  Use: string | null;
  Purpose: string | null;
  Direction: string | null;
  Classification: string | null;
  Breadth: string | null;
  CityPlanning: string | null;
  CoverageRatio: string | null;
  FloorAreaRatio: string | null;
  Period: string;
  Renovation: string | null;
  Remarks: string | null;
  NearestStation: string | null;
  TimeToNearestStation: string | null;
}

interface ApiResponse {
  status: string;
  data: RawTransaction[];
}

export interface FetchParams {
  year: number;
  quarter: number;
  area: string;
  city?: string;
  type?: string;
}

export type FetchResult =
  | { ok: true; data: RawTransaction[] }
  | { ok: false; error: "INVALID_API_KEY" | "RATE_LIMITED" | "FETCH_FAILED"; message: string };

export async function fetchTransactions(
  apiKey: string,
  params: FetchParams
): Promise<FetchResult> {
  const url = new URL(MLIT_API_ENDPOINT);
  url.searchParams.set("year", String(params.year));
  url.searchParams.set("quarter", String(params.quarter));
  url.searchParams.set("area", params.area);
  if (params.city) url.searchParams.set("city", params.city);
  if (params.type) url.searchParams.set("type", params.type);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: "FETCH_FAILED",
      message: `国土交通省APIへの接続に失敗しました。ネットワークエラー: ${String(err)}`,
    };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error: "INVALID_API_KEY",
      message: "APIキーが無効です。Cloudflareの環境変数 REALESTATE_API_KEY を確認してください。",
    };
  }

  if (res.status === 429) {
    return {
      ok: false,
      error: "RATE_LIMITED",
      message: "APIのレート制限に達しました。しばらく時間をおいてから再試行してください。",
    };
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch { /* ignore */ }
    return {
      ok: false,
      error: "FETCH_FAILED",
      message: `国土交通省APIエラー: HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`,
    };
  }

  let body: ApiResponse;
  try {
    body = await res.json() as ApiResponse;
  } catch (err) {
    return {
      ok: false,
      error: "FETCH_FAILED",
      message: `APIレスポンスの解析に失敗しました: ${String(err)}`,
    };
  }

  return { ok: true, data: body.data ?? [] };
}

export function getRecentQuarters(targetYear?: number): Array<{ year: number; quarter: number }> {
  // 不動産取引データの公開には最大6ヶ月の遅延があるため、
  // 現在時点から2四半期前を起点として直近4四半期分を取得する
  const now = new Date();
  let year = now.getFullYear();
  let quarter = Math.ceil((now.getMonth() + 1) / 3);

  if (targetYear !== undefined) {
    year = targetYear;
    quarter = 4;
  } else {
    quarter -= 2;
    while (quarter <= 0) {
      quarter += 4;
      year--;
    }
  }

  const quarters: Array<{ year: number; quarter: number }> = [];
  for (let i = 0; i < 4; i++) {
    quarters.push({ year, quarter });
    quarter--;
    if (quarter === 0) {
      quarter = 4;
      year--;
    }
  }

  return quarters;
}

export function parseWalkMinutes(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
