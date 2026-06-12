import "dotenv/config";
import { createPublicClient, createWalletClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { TOKENS, type TokenSymbol } from "./addresses.js";

const DEFAULT_FORK_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAINLINK_AGENTS_GATEWAY_URL = "https://agents.chain.link";
const DEFAULT_STALE_PRICE_SECONDS = 24 * 60 * 60;

export type PriceProvider = "agents" | "feeds";

export type AppConfig = {
  forkRpcUrl: string;
  priceProvider: PriceProvider;
  dryRun: boolean;
  thresholdBps: number;
  slippageBps: number;
  stalePriceSeconds: number;
  portfolioAddress: `0x${string}`;
  privateKey?: `0x${string}`;
  preferredFeeTier: number;
  chainlinkAgentsGatewayUrl: string;
  chainlinkAgentsApiKey?: string;
  chainlinkAgentsPriceEndpointTemplate?: string;
  chainlinkAgentsFeedIds: Partial<Record<TokenSymbol, string>>;
};

export function loadConfig(): AppConfig {
  const privateKey = normalizePrivateKey(process.env.PRIVATE_KEY);
  const account = privateKey ? privateKeyToAccount(privateKey) : undefined;
  const portfolioAddress = process.env.PORTFOLIO_ADDRESS ?? account?.address;

  if (!portfolioAddress || !isAddress(portfolioAddress)) {
    throw new Error(
      "Set PORTFOLIO_ADDRESS, or set PRIVATE_KEY so the wallet address can be inferred.",
    );
  }

  return {
    forkRpcUrl: process.env.FORK_RPC_URL ?? DEFAULT_FORK_RPC_URL,
    priceProvider: parsePriceProvider(process.env.PRICE_PROVIDER),
    dryRun: parseBoolean(process.env.DRY_RUN, true),
    thresholdBps: parseInteger(process.env.REBALANCE_THRESHOLD_BPS, 500),
    slippageBps: parseInteger(process.env.SLIPPAGE_BPS, 50),
    stalePriceSeconds: parseInteger(
      process.env.STALE_PRICE_SECONDS,
      DEFAULT_STALE_PRICE_SECONDS,
    ),
    portfolioAddress,
    privateKey,
    preferredFeeTier: parseInteger(process.env.UNISWAP_FEE_TIER, 500),
    chainlinkAgentsGatewayUrl:
      process.env.CHAINLINK_AGENTS_GATEWAY_URL ??
      DEFAULT_CHAINLINK_AGENTS_GATEWAY_URL,
    chainlinkAgentsApiKey: process.env.CHAINLINK_AGENTS_API_KEY,
    chainlinkAgentsPriceEndpointTemplate:
      process.env.CHAINLINK_AGENTS_PRICE_ENDPOINT_TEMPLATE,
    chainlinkAgentsFeedIds: {
      WETH: process.env.CHAINLINK_AGENTS_ETH_USD_FEED_ID,
      WBTC: process.env.CHAINLINK_AGENTS_BTC_USD_FEED_ID,
      USDC: process.env.CHAINLINK_AGENTS_USDC_USD_FEED_ID,
    },
  };
}

export function createClients(config: AppConfig) {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(config.forkRpcUrl),
  });

  if (!config.privateKey) {
    return { publicClient, walletClient: undefined, account: undefined };
  }

  const account = privateKeyToAccount(config.privateKey);
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(config.forkRpcUrl),
  });

  return { publicClient, walletClient, account };
}

export function getTokenSymbols(): TokenSymbol[] {
  return Object.keys(TOKENS) as TokenSymbol[];
}

function normalizePrivateKey(value: string | undefined) {
  if (!value) return undefined;
  const prefixed = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex string.");
  }
  return prefixed as `0x${string}`;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parsePriceProvider(value: string | undefined): PriceProvider {
  if (value === undefined || value === "") return "agents";
  if (value === "agents" || value === "feeds") return value;
  throw new Error('PRICE_PROVIDER must be either "agents" or "feeds".');
}

function parseInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }
  return parsed;
}
