import { calculateAllocation } from "./allocation.js";
import { readAllBalances } from "./balances.js";
import { createClients, getTokenSymbols, loadConfig } from "./config.js";
import { readConfiguredPrices } from "./priceProvider.js";
import { printPlan, printPrices, printSnapshot } from "./report.js";
import { buildRebalancePlan } from "./rebalance.js";

async function main() {
  const config = loadConfig();
  const symbols = getTokenSymbols();
  const { publicClient } = createClients(config);

  const [balances, prices] = await Promise.all([
    readAllBalances(publicClient, config.portfolioAddress, symbols),
    readConfiguredPrices(config, publicClient, symbols),
  ]);
  const snapshot = calculateAllocation(balances, prices, symbols);
  const plan = buildRebalancePlan(
    snapshot,
    balances,
    prices,
    config.thresholdBps,
  );

  printPrices(prices);
  printSnapshot(snapshot);
  printPlan(plan, config.thresholdBps);

  if (plan.action === "swap") {
    console.log(
      "\nNo Uniswap quote was requested. Run npm run rebalance:dry-run when you are ready to quote the swap.",
    );
  }
}

main().catch((error) => {
  console.error("\nRebalance plan failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
