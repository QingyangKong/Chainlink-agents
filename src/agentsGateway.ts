import type { AppConfig } from "./config.js";
import type { PriceQuote } from "./feeds.js";
import type { TokenSymbol } from "./addresses.js";

type JsonObject = Record<string, unknown>;

export async function fetchChainlinkAgentsSkills(config: AppConfig) {
  const response = await fetch(new URL("/v1/skills", config.chainlinkAgentsGatewayUrl));
  if (!response.ok) {
    throw new Error(
      `Chainlink for Agents skills request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
}

export async function readAllGatewayPrices(
  config: AppConfig,
  symbols: TokenSymbol[],
): Promise<Record<TokenSymbol, PriceQuote>> {
  if (!config.chainlinkAgentsPriceEndpointTemplate) {
    throw new Error(
      "Set CHAINLINK_AGENTS_PRICE_ENDPOINT_TEMPLATE, or use PRICE_PROVIDER=feeds as a fallback.",
    );
  }

  const prices = await Promise.all(
    symbols.map((symbol) => readGatewayPrice(config, symbol)),
  );

  return Object.fromEntries(
    prices.map((price) => [price.symbol, price]),
  ) as Record<TokenSymbol, PriceQuote>;
}

async function readGatewayPrice(
  config: AppConfig,
  symbol: TokenSymbol,
): Promise<PriceQuote> {
  const feedId = getFeedId(config, symbol);
  const url = buildPriceUrl(config, symbol, feedId);
  const response = await fetch(url, {
    headers: buildHeaders(config),
  });

  if (!response.ok) {
    throw new Error(
      `${symbol} Chainlink for Agents price request failed: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as unknown;
  const priceUsd = extractNumber(payload, [
    "price",
    "answer",
    "value",
    "mid",
    "benchmarkPrice",
    "report.price",
    "report.answer",
    "report.benchmarkPrice",
    "data.price",
    "data.answer",
    "data.benchmarkPrice",
  ]);
  const decimals = extractOptionalNumber(payload, [
    "decimals",
    "report.decimals",
    "data.decimals",
  ]);
  const normalizedPrice =
    decimals && Number.isInteger(priceUsd) && priceUsd > 10 ** decimals
      ? priceUsd / 10 ** decimals
      : priceUsd;
  const timestampSeconds = extractTimestampSeconds(payload);
  const ageSeconds = Math.floor(Date.now() / 1000) - timestampSeconds;

  if (ageSeconds > config.stalePriceSeconds) {
    throw new Error(
      `${symbol} Chainlink for Agents price is stale: ${ageSeconds}s old, max ${config.stalePriceSeconds}s.`,
    );
  }

  return {
    symbol,
    feedDescription: `Chainlink for Agents gateway (${feedId})`,
    priceUsd: normalizedPrice,
    decimals: decimals ?? 0,
    updatedAt: new Date(timestampSeconds * 1000),
  };
}

function getFeedId(config: AppConfig, symbol: TokenSymbol) {
  const feedId = config.chainlinkAgentsFeedIds[symbol];
  if (!feedId) {
    throw new Error(`Set CHAINLINK_AGENTS_${symbolToPair(symbol)}_FEED_ID.`);
  }
  return feedId;
}

function symbolToPair(symbol: TokenSymbol) {
  if (symbol === "WETH") return "ETH_USD";
  if (symbol === "WBTC") return "BTC_USD";
  return "USDC_USD";
}

function buildPriceUrl(config: AppConfig, symbol: TokenSymbol, feedId: string) {
  const path = config.chainlinkAgentsPriceEndpointTemplate!
    .replaceAll("{symbol}", encodeURIComponent(symbol))
    .replaceAll("{feedId}", encodeURIComponent(feedId));
  return new URL(path, config.chainlinkAgentsGatewayUrl);
}

function buildHeaders(config: AppConfig) {
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (config.chainlinkAgentsApiKey) {
    headers.authorization = `Bearer ${config.chainlinkAgentsApiKey}`;
  }
  return headers;
}

function extractTimestampSeconds(payload: unknown) {
  const value = extractNumber(payload, [
    "updatedAt",
    "timestamp",
    "observationsTimestamp",
    "validFromTimestamp",
    "report.updatedAt",
    "report.timestamp",
    "report.observationsTimestamp",
    "data.updatedAt",
    "data.timestamp",
    "data.observationsTimestamp",
  ]);
  return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
}

function extractNumber(payload: unknown, paths: string[]) {
  const value = extractOptionalNumber(payload, paths);
  if (value === undefined) {
    throw new Error(`Could not find a numeric field at: ${paths.join(", ")}`);
  }
  return value;
}

function extractOptionalNumber(payload: unknown, paths: string[]) {
  for (const path of paths) {
    const value = getPath(payload, path);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function getPath(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!isObject(current)) return undefined;
    return current[key];
  }, payload);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
