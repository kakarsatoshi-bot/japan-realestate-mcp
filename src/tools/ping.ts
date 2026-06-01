export const pingToolDefinition = {
  name: "ping",
  description:
    "Connection test tool for japan-realestate-mcp. " +
    "Returns pong with server version info.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export async function handlePing(): Promise<string> {
  return JSON.stringify({
    status: "pong",
    server: "japan-realestate-mcp",
    version: "1.0.0",
    data_source: "Ministry of Land, Infrastructure, Transport and Tourism (MLIT) — Real Estate Information Library API",
    timestamp: new Date().toISOString(),
  }, null, 2);
}
