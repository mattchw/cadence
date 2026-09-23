export class DatabaseConfigurationError extends Error {
  constructor(
    public code: "database_not_configured" | "database_configuration_invalid",
  ) {
    super(code);
  }
}

export function databaseSettings(env: {
  KV_REST_API_URL?: string;
  KV_REST_API_TOKEN?: string;
}) {
  const url = env.KV_REST_API_URL?.trim();
  const token = env.KV_REST_API_TOKEN?.trim();
  if (!url || !token)
    throw new DatabaseConfigurationError("database_not_configured");
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !["", "/"].includes(parsed.pathname) ||
      /\s|["']/.test(token)
    )
      throw new Error("invalid settings");
  } catch {
    throw new DatabaseConfigurationError("database_configuration_invalid");
  }
  return { url, token };
}
