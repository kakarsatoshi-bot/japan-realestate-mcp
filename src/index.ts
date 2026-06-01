import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { pingToolDefinition, handlePing } from "./tools/ping";
import { searchTransactionsDefinition, handleSearchTransactions } from "./tools/search_transactions";
import { getPriceSummaryDefinition, handleGetPriceSummary } from "./tools/get_price_summary";
import { getSupportedAreasDefinition, handleGetSupportedAreas } from "./tools/get_supported_areas";
import { withLogging } from "./utils/logger";

export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  REALESTATE_CACHE: KVNamespace;
  REALESTATE_API_KEY: string;
}

export class JapanRealEstateMcpAgent extends McpAgent<Env> {
  server = new McpServer({
    name: "japan-realestate-mcp",
    version: "1.0.0",
  });

  async init() {
    // Tool 1: ping
    this.server.registerTool(
      pingToolDefinition.name,
      {
        description: pingToolDefinition.description,
        inputSchema: {},
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => ({
        content: [{
          type: "text",
          text: await withLogging("ping", {}, () => handlePing()),
        }],
      })
    );

    // Tool 2: search_transactions
    this.server.registerTool(
      searchTransactionsDefinition.name,
      {
        description: searchTransactionsDefinition.description,
        inputSchema: {
          prefecture: z.string().describe("都道府県名（例：'東京都', '大阪府'）"),
          city: z.string().describe("市区町村名（例：'渋谷区', '大阪市中央区'）"),
          type: z.string().optional().describe("物件種別（例：'マンション', '土地', '一戸建て'）省略時は全種別"),
          year: z.number().optional().describe("取引年（例：2024）。省略時は直近4四半期"),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ prefecture, city, type, year }) => ({
        content: [{
          type: "text",
          text: await withLogging(
            "search_transactions",
            { prefecture, city, type, year },
            () => handleSearchTransactions(
              { prefecture, city, type, year },
              { REALESTATE_CACHE: this.env.REALESTATE_CACHE, REALESTATE_API_KEY: this.env.REALESTATE_API_KEY }
            )
          ),
        }],
      })
    );

    // Tool 3: get_price_summary
    this.server.registerTool(
      getPriceSummaryDefinition.name,
      {
        description: getPriceSummaryDefinition.description,
        inputSchema: {
          prefecture: z.string().describe("都道府県名（例：'東京都', '大阪府'）"),
          city: z.string().describe("市区町村名（例：'港区', '梅田区'）"),
          type: z.string().optional().describe("物件種別（例：'マンション', '土地'）省略時は全種別"),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ prefecture, city, type }) => ({
        content: [{
          type: "text",
          text: await withLogging(
            "get_price_summary",
            { prefecture, city, type },
            () => handleGetPriceSummary(
              { prefecture, city, type },
              { REALESTATE_CACHE: this.env.REALESTATE_CACHE, REALESTATE_API_KEY: this.env.REALESTATE_API_KEY }
            )
          ),
        }],
      })
    );

    // Tool 4: get_supported_areas
    this.server.registerTool(
      getSupportedAreasDefinition.name,
      {
        description: getSupportedAreasDefinition.description,
        inputSchema: {
          prefecture: z.string().optional().describe("都道府県名（省略時は全都道府県一覧）"),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ prefecture }) => ({
        content: [{
          type: "text",
          text: await withLogging(
            "get_supported_areas",
            { prefecture },
            () => handleGetSupportedAreas({ prefecture })
          ),
        }],
      })
    );
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          server: "japan-realestate-mcp",
          version: "1.0.0",
          data_source: "MLIT Real Estate Information Library API (XIT001)",
          timestamp: new Date().toISOString(),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/mcp") {
      return JapanRealEstateMcpAgent.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response(
      JSON.stringify({
        name: "Japan Real Estate MCP",
        description: "Real estate transaction data for Japan powered by MLIT official API",
        mcp_endpoint: "/mcp",
        health_endpoint: "/health",
        tools: [
          "ping",
          "search_transactions",
          "get_price_summary",
          "get_supported_areas",
        ],
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  },
} satisfies ExportedHandler<Env>;
