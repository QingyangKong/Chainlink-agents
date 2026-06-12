import type { PublicClient } from "viem";
import { readAllGatewayPrices } from "./agentsGateway.js";
import type { TokenSymbol } from "./addresses.js";
import type { AppConfig } from "./config.js";
import { readAllPrices as readAllFeedPrices } from "./feeds.js";

export function readConfiguredPrices(
  config: AppConfig,
  publicClient: PublicClient,
  symbols: TokenSymbol[],
) {
  if (config.priceProvider === "agents") {
    return readAllGatewayPrices(config, symbols);
  }

  return readAllFeedPrices(publicClient, symbols, config.stalePriceSeconds);
}
