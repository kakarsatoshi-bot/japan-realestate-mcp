# Japan Real Estate MCP

An MCP (Model Context Protocol) server that lets AI assistants like Claude query Japan's official real estate transaction data.

**Ask questions like:**
- "What are recent condo prices in Shibuya, Tokyo?"
- "Show me land transaction prices in Sapporo's central district"
- "Give me a price summary for apartments in Minato-ku"

Powered by the Ministry of Land, Infrastructure, Transport and Tourism (MLIT) **Real Estate Information Library API (XIT001)**.

## Tools

| Tool | Description |
|------|-------------|
| `ping` | Connection test — returns server version info |
| `search_transactions` | Search transaction records by prefecture, city, and property type |
| `get_price_summary` | Get statistical price summary (avg, median, min, max, ¥/㎡) |
| `get_supported_areas` | List supported prefectures and cities |

## Usage (Claude Desktop)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "japan-realestate": {
      "type": "http",
      "url": "https://japan-realestate-mcp.tsukuras-jp.workers.dev/mcp"
    }
  }
}
```

## Data Source

- **Provider**: Ministry of Land, Infrastructure, Transport and Tourism (国土交通省)
- **API**: Real Estate Information Library API — XIT001
- **URL**: https://www.reinfolib.mlit.go.jp
- **License**: CC BY 4.0
- **Update frequency**: Quarterly

> **Note**: An API key from MLIT is required for deployment. Apply at https://www.reinfolib.mlit.go.jp/api/request/

## Development

```bash
# Install dependencies
npm install

# Local development (requires .dev.vars with REALESTATE_API_KEY)
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

### Local environment variables

Create `.dev.vars` (never commit this file — it is in .gitignore):

```
REALESTATE_API_KEY=your_api_key_here
```

## Tech Stack

- TypeScript + Cloudflare Workers
- Cloudflare KV (cache, TTL: 7 days)
- MCP SDK (`agents` + `@modelcontextprotocol/sdk`)

## License

MIT


## 🔗 Related MCPs (Japan Data Series)

| MCP | Description |
|---|---|
| [japan-holiday-mcp](https://github.com/kakarsatoshi-bot/japan-holiday-mcp) | Japanese national holidays |
| [japan-weather-mcp](https://github.com/kakarsatoshi-bot/japan-weather-mcp) | Japan weather forecast (JMA) |
| [japan-realestate-mcp](https://github.com/kakarsatoshi-bot/japan-realestate-mcp) | Japan real estate transaction prices (MLIT) |