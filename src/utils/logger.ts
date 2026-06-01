export async function withLogging<T>(
  toolName: string,
  params: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(JSON.stringify({
      type: "mcp_query",
      timestamp: new Date().toISOString(),
      tool_name: toolName,
      params,
      status: "success",
      latency_ms: Date.now() - start,
    }));
    return result;
  } catch (err) {
    console.log(JSON.stringify({
      type: "mcp_query",
      timestamp: new Date().toISOString(),
      tool_name: toolName,
      params,
      status: "error",
      latency_ms: Date.now() - start,
      error_code: String(err),
    }));
    throw err;
  }
}
