# OpenClaw + Chainlink for Agents Portfolio Rebalancing Demo

This demo shows an AI-agent-style portfolio rebalance loop using Chainlink for Agents for price discovery and a local Ethereum mainnet fork for deterministic Uniswap execution.

The agent monitors `WETH / WBTC / USDC`, values the portfolio with verified pricing data from the Chainlink for Agents gateway, checks target allocation drift, and optionally executes a Uniswap V3 swap on the fork.

Default target:

- `WETH`: 50%
- `WBTC`: 30%
- `USDC`: 20%
- Rebalance threshold: 5 percentage points

## Why This Is Safe For A Demo

The project is designed for a local mainnet fork. It uses forked ERC20 and Uniswap contracts for balances and swaps, but price discovery is designed to go through Chainlink for Agents. Transactions execute only against your forked node.

Do not use this code with a real mainnet private key. Keep `DRY_RUN=true` until you have inspected the quote and transaction plan.

## Components

- OpenClaw + Chainlink for Agents skill: Interactive operator flow. Use this to retrieve gateway skills, get verified prices, inspect portfolio value, and decide whether to rebalance.
- Chainlink for Agents gateway: Hosted HTTP gateway for agent access to Chainlink services such as Data Streams and guardrailed onchain workflows.
- `src/agentsGateway.ts`: Configurable Chainlink for Agents gateway client for skill retrieval and Data Streams price calls.
- `src/feeds.ts`: Optional fallback price reader using direct Chainlink Data Feed contracts on the fork.
- `src/balances.ts`: Optional deterministic balance reader.
- `src/allocation.ts`: Optional deterministic allocation calculator.
- `src/rebalance.ts`: Optional deterministic rebalance planner.
- `src/uniswap.ts`: Swap execution helper for the final rebalance step.
- `scripts/seedFork.ts`: Seeds a fork wallet by impersonating configured token holders.

The preferred demo path is hybrid: Chainlink for Agents powers the price step, while local scripts keep portfolio math and Uniswap execution deterministic for a reliable demo.

## Local vs Server

If OpenClaw cannot run on your local machine, treat an AWS EC2 Ubuntu instance as the runtime environment for this demo.

Run these tasks locally:

- Edit code in Cursor.
- Commit and push the repo to GitHub or another Git remote.
- SSH into the EC2 instance when you want to run the demo.

Run these tasks on the EC2 instance:

- Clone or pull this repo.
- Install Node.js, Foundry/Anvil, OpenClaw, and the Chainlink for Agents skill/gateway setup.
- Configure `.env`.
- Run `npm install`.
- Start the Anvil mainnet fork with `npm run fork`.
- Seed the fork wallet with `npm run seed`.
- Use the interactive OpenClaw prompts below; use `npm run rebalance:dry-run` and `npm run rebalance:execute` only as validation/execution helpers.

Recommended flow:

```text
Local Cursor repo
  -> git push
  -> AWS EC2 git pull
  -> OpenClaw + Anvil + npm scripts run on EC2
```

Do not run Anvil locally while OpenClaw runs on EC2 unless you also configure SSH port forwarding. The simplest setup is to keep the repo, OpenClaw, Anvil, and demo commands all on the same EC2 instance.

## AWS Low-Cost Setup

Use a short-lived EC2 instance for the demo. If your AWS account is older than 12 months, EC2 is usually not free, but running this for a few hours should be inexpensive if you keep the instance small and shut it down afterward.

Recommended cheapest setup:

- Service: EC2
- AMI: Ubuntu Server 22.04 LTS or 24.04 LTS
- Instance type: start with `t3.micro`; use `t3.small` only if OpenClaw or Anvil is too slow
- Storage: `30 GB gp3`
- Security Group: allow SSH `22` from your IP only
- Do not create a NAT Gateway
- Do not expose Anvil port `8545` to the internet

Rough short-run cost expectation:

- `t3.micro`: usually only a few cents USD for a few hours, region-dependent
- `t3.small`: still low for a short demo, but not free and roughly higher than `t3.micro`
- EBS disk and public IPv4 can also add small hourly charges

Stop the instance when you are done for the day. Terminate it when you no longer need the demo, and make sure the EBS volume is deleted.

### Create The EC2 Instance

In the AWS Console:

1. Open `EC2` -> `Launch instance`.
2. Name it `chainlink-rebalance-demo`.
3. Select Ubuntu Server 22.04 LTS or 24.04 LTS.
4. Select `t3.micro` first. Upgrade to `t3.small` if needed.
5. Create or select an SSH key pair.
6. Configure Security Group inbound rules:
   - SSH `22` from `My IP`
   - No inbound rule for `8545`
7. Set storage to `30 GB gp3`.
8. Launch the instance.

SSH into EC2 from your local machine:

```shell
chmod 600 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

### Install Runtime Dependencies On EC2

```shell
sudo apt-get update
sudo apt-get install -y curl git build-essential unzip

# Install Node.js LTS:
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version

# Install Foundry / Anvil:
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
anvil --version
```

Install OpenClaw according to the OpenClaw documentation, then verify:

```shell
openclaw --version
```

In this local Cursor environment, `openclaw` was not available, so this README assumes OpenClaw runs on EC2.

## Install Chainlink for Agents Skill

For this version of the demo, the primary Chainlink integration is **Chainlink for Agents**. It is a hosted HTTP gateway plus bundled agent skills. The agent uses the gateway skill to discover the available Chainlink for Agents services, complete onboarding, and retrieve verified pricing data.

Install the Chainlink for Agents skill bundle on EC2 from the gateway:

```shell
export CHAINLINK_AGENTS_URL="https://agents.chain.link"
curl -sSL "$CHAINLINK_AGENTS_URL/v1/skills/bundle" -o chainlink-for-agents.zip
rm -rf chainlink-for-agents
unzip -o chainlink-for-agents.zip -d chainlink-for-agents
openclaw skills install ./chainlink-for-agents/chainlink-for-agents --as chainlink-for-agents
openclaw skills list
```

Some OpenClaw builds use singular commands:

```shell
openclaw skill install ./chainlink-for-agents/chainlink-for-agents --as chainlink-for-agents
openclaw skill list
```

The root skill guide is also available at `/v1/skills`. Use this to inspect what the agent will load:

```shell
npm run agents:skills
```

Chainlink for Agents is currently in Preview. Expect the agent to handle or ask you about:

- gateway registration
- signing Terms of Service with a local EVM wallet
- a Base wallet funded with USDC for x402 micropayments
- optional SVA provisioning for guardrailed onchain actions
- Data Streams feed IDs and endpoint details

For this demo, install only the Chainlink for Agents bundle above. The direct Data Feed contract reader remains available only as a fallback with `PRICE_PROVIDER=feeds`.

## Hybrid OpenClaw Workflow

This is the recommended demo flow on a small EC2 instance. Use Chainlink for Agents for the price step, then use the local fork for balances and Uniswap execution. The Chainlink for Agents guardrailed onchain experience is not assumed to support this custom Uniswap rebalance workflow; local Uniswap execution remains deterministic and fork-only.

Start OpenClaw from this repo so `!` shell commands and `.env` resolution use the correct working directory:

```shell
cd agents-learning
openclaw chat
```

Inside OpenClaw, you can verify the working directory with:

```text
!pwd
```

### Step 1: Ask OpenClaw To Use Chainlink for Agents Prices

Prompt:

```text
Use the Chainlink for Agents skill from https://agents.chain.link/v1/skills.

Complete any required Chainlink for Agents onboarding steps for Data Streams access. Use a Base wallet with USDC for x402 micropayments if required.

Then retrieve the latest verified prices for:
- ETH/USD
- BTC/USD
- USDC/USD

Important boundary:
- Price source: Chainlink for Agents gateway / Data Streams.
- Do not read portfolio balances in this step.
- Do not use the local fork in this step except to read `.env` if needed.

For each price:
- show which Chainlink for Agents/Data Streams feed or report you used
- show the USD price
- show the report timestamp or freshness metadata
- mention any gateway payment, registration, or preview limitation

Do not read balances and do not rebalance yet.
```

Expected agent behavior:

- Retrieve or use the Chainlink for Agents skill.
- Use Chainlink for Agents/Data Streams for price discovery.
- Return prices and freshness checks before moving on.
- Keep the interaction short and wait for the next prompt.

If onboarding gives you concrete Data Streams endpoint and feed IDs, add them to `.env` so scripts can use the gateway too:

```shell
PRICE_PROVIDER="agents"
CHAINLINK_AGENTS_PRICE_ENDPOINT_TEMPLATE="/replace/with/preview/endpoint?feedId={feedId}"
CHAINLINK_AGENTS_ETH_USD_FEED_ID="..."
CHAINLINK_AGENTS_BTC_USD_FEED_ID="..."
CHAINLINK_AGENTS_USDC_USD_FEED_ID="..."
```

If the Chainlink for Agents preview endpoint is unavailable, switch scripts to direct Data Feed contracts as a fallback:

```shell
PRICE_PROVIDER=feeds
```

### Step 2: Ask OpenClaw To Check Portfolio Value

Prompt:

```text
Using the Chainlink for Agents prices you just retrieved, check whether my fork portfolio allocation matches the target.

Important boundary:
- Price source: use only the Chainlink for Agents prices from Step 1.
- Portfolio state source: use only the local Ethereum mainnet fork at FORK_RPC_URL from .env.
- Do not query real mainnet balances.
- Do not send any transaction.

Use PORTFOLIO_ADDRESS from .env.

Portfolio assets:
- WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
- WBTC: 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
- USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

Target allocation:
- WETH 50%
- WBTC 30%
- USDC 20%

Rebalance threshold: 5 percentage points.

Please report:
- token balances
- USD value per asset
- current allocation percentage
- target allocation percentage
- drift from target
- whether rebalancing is needed

Do not execute any swap yet.
```

Expected agent behavior:

- Read ERC20 balanceOf() and decimals() directly from the fork.
- Combine balances with the Chainlink prices from Step 1.
- Explain whether the portfolio is inside or outside the threshold.
- Do not query Uniswap yet.

### Step 3: Prepare A Rebalance Plan Without Uniswap Quote

Prompt:

```text
Run this command and summarize the rebalance plan:

!npm run rebalance:plan

Important boundary:
- This command must run inside this repo on EC2.
- The script reads fork balances from FORK_RPC_URL in .env.
- The script uses PRICE_PROVIDER from .env for prices.
- Treat this as a local fork planning step, not a real mainnet action.

Identify which asset is overweight, which asset is underweight, and the approximate USD amount to rebalance.
Do not query Uniswap and do not execute.
```

Direct EC2 terminal fallback:

```shell
npm run rebalance:plan
```

### Step 4: Get A Deterministic Uniswap Quote

Only after the plan looks correct, ask OpenClaw to run the dry-run script:

```text
Now get a deterministic Uniswap quote using the helper script:

!npm run rebalance:dry-run

Important boundary:
- This quote is for the local fork only.
- Use FORK_RPC_URL from .env.
- Do not use real mainnet RPC for quote or execution.
- Do not send any transaction.

Summarize the proposed swap, expected output, slippage, and fee tier.
Do not execute.
```

Direct EC2 terminal fallback:

```shell
npm run rebalance:dry-run
```

### Step 5: Execute Only After Confirmation

After reviewing the dry-run quote, send a new prompt:

```text
Execute the rebalance on the local fork using the deterministic helper:

!npm run rebalance:execute

Important boundary:
- Execute only on the local fork at FORK_RPC_URL from .env.
- Use the fork-only PRIVATE_KEY from .env.
- Do not send any transaction to real mainnet.
- Do not use AGENT_PRIVATE_KEY for the Uniswap swap.

After execution, show the transaction hash and then run:

!npm run rebalance:dry-run

Summarize the updated allocation.
```

This keeps the Chainlink for Agents price step agent-driven, while using deterministic helpers for the heavier rebalance planning, Uniswap quote, and swap construction. OpenClaw remains useful as the operator and explainer, while Chainlink for Agents provides the runtime gateway for verified pricing data.

## Project Setup On EC2

```shell
git clone <YOUR_REPO_URL>
cd agents-learning
npm install
cp .env.example .env
```

Edit `.env` and set `MAINNET_RPC_URL` to an Ethereum mainnet RPC URL.

The default price provider is Chainlink for Agents:

```shell
PRICE_PROVIDER="agents"
CHAINLINK_AGENTS_GATEWAY_URL="https://agents.chain.link"
```

After Chainlink for Agents onboarding, fill these values from the gateway skill/API docs:

```shell
CHAINLINK_AGENTS_PRICE_ENDPOINT_TEMPLATE="..."
CHAINLINK_AGENTS_ETH_USD_FEED_ID="..."
CHAINLINK_AGENTS_BTC_USD_FEED_ID="..."
CHAINLINK_AGENTS_USDC_USD_FEED_ID="..."
```

If the Preview gateway is unavailable during the demo, switch to direct forked Data Feed contracts:

```shell
PRICE_PROVIDER="feeds"
```

The example private key is Anvil's default first account. It is public and should only be used on a local fork.

## Run The Demo

Run these commands on EC2.

Start the fork in terminal 1:

```shell
npm run fork
```

In terminal 2, seed the demo wallet:

```shell
npm run seed
```

Then use the prompts in `Hybrid OpenClaw Workflow`:

1. Ask OpenClaw to use Chainlink for Agents to retrieve verified prices.
2. Ask OpenClaw to read balances and calculate the portfolio against the explicit `50/30/20` target.
3. Run `npm run rebalance:plan` and ask OpenClaw to explain the plan.
4. Run `npm run rebalance:dry-run` for a deterministic Uniswap quote.
5. Confirm with a new prompt before `npm run rebalance:execute`.

The deterministic TypeScript path is still available for rebalance planning, Uniswap quote, execution, and post-trade checks.

Run a full dry-run report:

```shell
npm run rebalance:dry-run
```

Execute on the fork only after reviewing the interactive plan and quote:

```shell
npm run rebalance:execute
```

Run the dry-run again as a post-trade check:

```shell
npm run rebalance:dry-run
```

## AWS Cost Control

Use this checklist to keep the demo cheap:

- Use `t3.micro` first. Move to `t3.small` only if the demo is too slow.
- Keep storage around `30 GB gp3`.
- Do not create a NAT Gateway.
- Do not use Elastic Load Balancer.
- Do not allocate an Elastic IP unless you need a stable IP.
- Stop the EC2 instance when pausing the demo.
- Terminate the EC2 instance when finished.
- Confirm the EBS volume is deleted after termination.
- Set an AWS Billing Alert before experimenting.

When the instance is stopped, EC2 compute charges stop, but EBS storage and public IPv4-related charges can continue. Termination is the cleanest way to stop all demo infrastructure costs.

## Configuration

Important environment variables:

- `MAINNET_RPC_URL`: RPC used by Anvil to fork Ethereum mainnet.
- `FORK_RPC_URL`: Local fork RPC, default `http://127.0.0.1:8545`.
- `PRICE_PROVIDER`: `agents` uses Chainlink for Agents gateway; `feeds` uses direct Chainlink Data Feed contracts on the fork.
- `CHAINLINK_AGENTS_GATEWAY_URL`: Chainlink for Agents gateway, default `https://agents.chain.link`.
- `CHAINLINK_AGENTS_API_KEY`: Optional gateway/API credential if your Preview access requires it.
- `CHAINLINK_AGENTS_PRICE_ENDPOINT_TEMPLATE`: Preview Data Streams price endpoint template. Supports `{feedId}` and `{symbol}` placeholders.
- `CHAINLINK_AGENTS_ETH_USD_FEED_ID`, `CHAINLINK_AGENTS_BTC_USD_FEED_ID`, `CHAINLINK_AGENTS_USDC_USD_FEED_ID`: Data Streams feed IDs from Chainlink for Agents onboarding.
- `PRIVATE_KEY`: Fork-only key that controls the portfolio wallet.
- `PORTFOLIO_ADDRESS`: Wallet monitored and rebalanced.
- `DRY_RUN`: `true` prints the plan only; `false` sends fork transactions.
- `REBALANCE_THRESHOLD_BPS`: Drift threshold in basis points. `500` is 5%.
- `SLIPPAGE_BPS`: Uniswap minimum-output tolerance. `50` is 0.5%.
- `STALE_PRICE_SECONDS`: Reject Chainlink feed prices older than this.
- `UNISWAP_FEE_TIER`: Preferred Uniswap V3 fee tier. The code falls back to `500`, `3000`, then `10000`.

Seed overrides:

- `SEED_WETH`, `SEED_WBTC`, `SEED_USDC`
- `WETH_WHALE`, `WBTC_WHALE`, `USDC_WHALE`

If a default whale no longer has enough balance at your fork block, set the corresponding `*_WHALE` address to another holder.

## NPM Script Reference

Use these commands on EC2 when you want to avoid long agent runs:

- `npm run fork`: Start the local Anvil mainnet fork.
- `npm run seed`: Seed the fork wallet with ETH gas and test token balances.
- `npm run agents:skills`: Fetch the Chainlink for Agents gateway skill from `/v1/skills`.
- `npm run rebalance:plan`: Calculate the rebalance plan without querying Uniswap.
- `npm run rebalance:dry-run`: Query Uniswap and print the proposed swap without execution.
- `npm run rebalance:execute`: Execute the swap on the fork.

## Validation

Run TypeScript checks:

```shell
npm run check
```

## Demo Talking Points

- OpenClaw uses Chainlink for Agents during the live price-read step, so the agent demonstrates a runtime gateway flow instead of only using a development skill.
- Chainlink for Agents can provide verified pricing through Data Streams with agent registration and x402 payments; direct Data Feed contracts remain a local fallback.
- Portfolio valuation and rebalance planning happen in separate prompts, making the decision process explicit and auditable.
- TypeScript helpers keep fork balances, rebalance planning, Uniswap quote, and swap execution deterministic.
- Uniswap performs the portfolio composition change on the local fork after explicit confirmation.
- Dry-run mode, slippage, stale-price checks, and fork-only execution are the core safety boundaries.
