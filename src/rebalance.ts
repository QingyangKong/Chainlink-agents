import { parseUnits } from "viem";
import { type TokenSymbol } from "./addresses.js";
import type { TokenBalance } from "./balances.js";
import type { PriceQuote } from "./feeds.js";
import type { AllocationRow, PortfolioSnapshot } from "./allocation.js";

export type RebalancePlan =
  | {
      action: "none";
      reason: string;
      maxDriftBps: number;
    }
  | {
      action: "swap";
      sell: TokenSymbol;
      buy: TokenSymbol;
      sellUsd: number;
      amountIn: bigint;
      amountInHuman: number;
      expectedNewSellBps: number;
      expectedNewBuyBps: number;
      maxDriftBps: number;
    };

export function buildRebalancePlan(
  snapshot: PortfolioSnapshot,
  balances: Record<TokenSymbol, TokenBalance>,
  prices: Record<TokenSymbol, PriceQuote>,
  thresholdBps: number,
): RebalancePlan {
  const rowsByDrift = [...snapshot.rows].sort(
    (a, b) => Math.abs(b.driftBps) - Math.abs(a.driftBps),
  );
  const maxDriftBps = Math.abs(rowsByDrift[0]?.driftBps ?? 0);

  if (maxDriftBps <= thresholdBps) {
    return {
      action: "none",
      reason: `Max drift ${maxDriftBps} bps is within threshold ${thresholdBps} bps.`,
      maxDriftBps,
    };
  }

  const overweight = snapshot.rows
    .filter((row) => row.driftBps > thresholdBps)
    .sort((a, b) => b.driftBps - a.driftBps)[0];
  const underweight = snapshot.rows
    .filter((row) => row.driftBps < -thresholdBps)
    .sort((a, b) => a.driftBps - b.driftBps)[0];

  if (!overweight || !underweight) {
    return {
      action: "none",
      reason:
        "Portfolio drift exceeded the threshold, but no direct overweight/underweight pair was found.",
      maxDriftBps,
    };
  }

  const sellUsd = calculateSellUsd(snapshot.totalValueUsd, overweight, underweight);
  const sellPrice = prices[overweight.symbol].priceUsd;
  const amountInHuman = sellUsd / sellPrice;
  const amountIn = decimalToUnits(amountInHuman, balances[overweight.symbol].decimals);

  return {
    action: "swap",
    sell: overweight.symbol,
    buy: underweight.symbol,
    sellUsd,
    amountIn,
    amountInHuman,
    expectedNewSellBps: estimateBpsAfterTrade(
      snapshot.totalValueUsd,
      overweight.valueUsd - sellUsd,
    ),
    expectedNewBuyBps: estimateBpsAfterTrade(
      snapshot.totalValueUsd,
      underweight.valueUsd + sellUsd,
    ),
    maxDriftBps,
  };
}

function calculateSellUsd(
  totalValueUsd: number,
  overweight: AllocationRow,
  underweight: AllocationRow,
) {
  const overweightUsd = (overweight.driftBps / 10_000) * totalValueUsd;
  const underweightUsd = (Math.abs(underweight.driftBps) / 10_000) * totalValueUsd;
  return Math.min(overweightUsd, underweightUsd);
}

function estimateBpsAfterTrade(totalValueUsd: number, valueUsd: number) {
  return Math.round((valueUsd / totalValueUsd) * 10_000);
}

function decimalToUnits(value: number, decimals: number) {
  const precision = Math.min(decimals, 8);
  return parseUnits(value.toFixed(precision), decimals);
}
