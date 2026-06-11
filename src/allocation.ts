import { TOKENS, type TokenSymbol } from "./addresses.js";
import type { TokenBalance } from "./balances.js";
import type { PriceQuote } from "./feeds.js";

export type AllocationRow = {
  symbol: TokenSymbol;
  amount: number;
  priceUsd: number;
  valueUsd: number;
  targetBps: number;
  actualBps: number;
  driftBps: number;
};

export type PortfolioSnapshot = {
  totalValueUsd: number;
  rows: AllocationRow[];
};

export function calculateAllocation(
  balances: Record<TokenSymbol, TokenBalance>,
  prices: Record<TokenSymbol, PriceQuote>,
  symbols: TokenSymbol[],
): PortfolioSnapshot {
  const values = symbols.map((symbol) => {
    const balance = balances[symbol];
    const price = prices[symbol];
    return {
      symbol,
      amount: balance.amount,
      priceUsd: price.priceUsd,
      valueUsd: balance.amount * price.priceUsd,
      targetBps: TOKENS[symbol].targetBps,
    };
  });

  const totalValueUsd = values.reduce((sum, row) => sum + row.valueUsd, 0);
  if (totalValueUsd <= 0) {
    throw new Error("Portfolio has no USD value. Seed the fork wallet first.");
  }

  const rows = values.map((row) => {
    const actualBps = Math.round((row.valueUsd / totalValueUsd) * 10_000);
    return {
      ...row,
      actualBps,
      driftBps: actualBps - row.targetBps,
    };
  });

  return { totalValueUsd, rows };
}

export function formatBps(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
