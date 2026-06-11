import type { Address } from "viem";

export type TokenSymbol = "WETH" | "WBTC" | "USDC";

export type TokenConfig = {
  symbol: TokenSymbol;
  address: Address;
  decimals: number;
  targetBps: number;
  feed: Address;
};

export const TOKENS: Record<TokenSymbol, TokenConfig> = {
  WETH: {
    symbol: "WETH",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
    targetBps: 5_000,
    feed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  },
  WBTC: {
    symbol: "WBTC",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    targetBps: 3_000,
    feed: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
  },
  USDC: {
    symbol: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    targetBps: 2_000,
    feed: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
  },
};

export const UNISWAP_V3_SWAP_ROUTER_02 =
  "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" as const;

export const UNISWAP_V3_QUOTER_V2 =
  "0x61fFE014bA17989E743c5F6cB21bF9697530B21e" as const;
