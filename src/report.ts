import { formatUnits } from "viem";
import { TOKENS } from "./addresses.js";
import {
  formatBps,
  formatUsd,
  type PortfolioSnapshot,
} from "./allocation.js";
import type { PriceQuote } from "./feeds.js";
import type { RebalancePlan } from "./rebalance.js";
import type { SwapQuote } from "./uniswap.js";

export function printPrices(prices: Record<string, PriceQuote>) {
  console.log("\nChainlink prices");
  for (const price of Object.values(prices)) {
    console.log(
      `- ${price.symbol}: ${formatUsd(price.priceUsd)} from ${price.feedDescription}, updated ${price.updatedAt.toISOString()}`,
    );
  }
}

export function printSnapshot(snapshot: PortfolioSnapshot) {
  console.log("\nPortfolio allocation");
  console.log(`Total value: ${formatUsd(snapshot.totalValueUsd)}`);
  for (const row of snapshot.rows) {
    console.log(
      `- ${row.symbol}: ${row.amount.toFixed(8)} (${formatUsd(row.valueUsd)}) actual=${formatBps(row.actualBps)} target=${formatBps(row.targetBps)} drift=${formatBps(row.driftBps)}`,
    );
  }
}

export function printPlan(plan: RebalancePlan, thresholdBps: number) {
  console.log("\nRebalance decision");
  console.log(`Threshold: ${formatBps(thresholdBps)}`);

  if (plan.action === "none") {
    console.log(`No rebalance needed. ${plan.reason}`);
    return;
  }

  console.log(
    `Swap ${plan.amountInHuman.toFixed(8)} ${plan.sell} (${formatUsd(plan.sellUsd)}) into ${plan.buy}.`,
  );
  console.log(
    `Expected post-trade weights: ${plan.sell} ${formatBps(plan.expectedNewSellBps)}, ${plan.buy} ${formatBps(plan.expectedNewBuyBps)}.`,
  );
}

export function printQuote(plan: RebalancePlan, quote: SwapQuote) {
  if (plan.action !== "swap") return;
  const buyToken = TOKENS[plan.buy];
  console.log("\nUniswap quote");
  console.log(`Pool fee tier: ${quote.feeTier}`);
  console.log(
    `Expected output: ${formatUnits(quote.amountOut, buyToken.decimals)} ${plan.buy}`,
  );
  console.log(
    `Minimum output after slippage: ${formatUnits(
      quote.amountOutMinimum,
      buyToken.decimals,
    )} ${plan.buy}`,
  );
  console.log(`Estimated quote gas: ${quote.gasEstimate.toString()}`);
}
