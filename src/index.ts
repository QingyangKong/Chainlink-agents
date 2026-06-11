import { getTokenSymbols, loadConfig, createClients } from "./config.js";
import { readAllBalances } from "./balances.js";
import { readAllPrices } from "./feeds.js";
import { calculateAllocation } from "./allocation.js";
import { buildRebalancePlan } from "./rebalance.js";
import { executeSwap, quoteBestSwap } from "./uniswap.js";
import { printPlan, printPrices, printQuote, printSnapshot } from "./report.js";

async function main() {
  const config = loadConfig();
  const symbols = getTokenSymbols();
  const { publicClient, walletClient, account } = createClients(config);

  console.log("OpenClaw + Chainlink Portfolio Rebalancing Demo");
  console.log(`Portfolio: ${config.portfolioAddress}`);
  console.log(`RPC: ${config.forkRpcUrl}`);
  console.log(`Mode: ${config.dryRun ? "dry-run" : "execute"}`);

  const [balances, prices] = await Promise.all([
    readAllBalances(publicClient, config.portfolioAddress, symbols),
    readAllPrices(publicClient, symbols, config.stalePriceSeconds),
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

  if (plan.action !== "swap") {
    return;
  }

  const quote = await quoteBestSwap(
    publicClient,
    plan.sell,
    plan.buy,
    plan.amountIn,
    config.preferredFeeTier,
    config.slippageBps,
  );
  printQuote(plan, quote);

  if (config.dryRun) {
    console.log("\nDry-run enabled. Set DRY_RUN=false to execute on the fork.");
    return;
  }

  if (!walletClient || !account) {
    throw new Error("Set PRIVATE_KEY to execute a swap.");
  }
  if (account.address.toLowerCase() !== config.portfolioAddress.toLowerCase()) {
    throw new Error(
      "For this demo, PRIVATE_KEY must control PORTFOLIO_ADDRESS before executing swaps.",
    );
  }

  const receipt = await executeSwap({
    publicClient,
    walletClient,
    account,
    sell: plan.sell,
    buy: plan.buy,
    amountIn: plan.amountIn,
    quote,
  });

  console.log("\nSwap executed");
  console.log(`Transaction: ${receipt.transactionHash}`);
  console.log(`Block: ${receipt.blockNumber.toString()}`);
}

main().catch((error) => {
  console.error("\nDemo failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
