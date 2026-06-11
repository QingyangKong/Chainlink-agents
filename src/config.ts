import "dotenv/config";
import { createPublicClient, createWalletClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { TOKENS, type TokenSymbol } from "./addresses.js";

const DEFAULT_FORK_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_STALE_PRICE_SECONDS = 24 * 60 * 60;

export type AppConfig = {
  forkRpcUrl: string;
  dryRun: boolean;
  thresholdBps: number;
  slippageBps: number;
  stalePriceSeconds: number;
  portfolioAddress: `0x${string}`;
  privateKey?: `0x${string}`;
  preferredFeeTier: number;
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

function parseInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }
  return parsed;
}
