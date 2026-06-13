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

You can run the agent on a dedicated server instead of your local machine. This keeps OpenClaw, Anvil, and the agent workspace away from your local files, reducing the risk that local environment data or sensitive files are accidentally exposed to the agent. To run the demo this way, see [Local vs Server](#local-vs-server).

## Components

- OpenClaw + Chainlink for Agents skill: Interactive operator flow. Use this to retrieve gateway skills, get verified prices, inspect portfolio value, and decide whether to rebalance.
- Chainlink for Agents gateway: Hosted HTTP gateway for agent access to Chainlink services such as Data Streams and guardrailed onchain workflows.
- `src/agentsGateway.ts`: Chainlink for Agents gateway client for skill retrieval.
- `src/agentsSkills.ts`: Prints the Chainlink for Agents root skill guide from the gateway.
- `src/abi.ts` and `src/addresses.ts`: Shared ABI/address definitions used by the seed script.
- `scripts/seedFork.ts`: Seeds a fork wallet by impersonating configured token holders.

The preferred demo path is hybrid: Chainlink for Agents powers the price step, while local scripts keep portfolio math and Uniswap execution deterministic for a reliable demo.

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

For this demo, install only the Chainlink for Agents bundle above. Chainlink for Agents price retrieval happens through OpenClaw in Step 1, not through a local script.

## Hybrid OpenClaw Workflow

This workflow is the same whether you run it locally or on EC2. Use Chainlink for Agents for the price step, then use the local fork for balances and final execution. When the prompts mention Ethereum mainnet token or transaction target addresses, they mean those mainnet addresses as copied into the local fork at `FORK_RPC_URL`; they do not mean sending transactions to real mainnet. If the Chainlink for Agents catalog supports `token-swap`, use it as a guardrailed transaction JSON builder, then apply the returned JSON only to the local fork.

### Step 0: Prepare The Repo, Fork, And Seeded Wallet

From the machine where OpenClaw will run:

```shell
git clone <YOUR_REPO_URL>
cd agents-learning
npm install
cp .env.example .env
```

Edit `.env` and set `MAINNET_RPC_URL` to an Ethereum mainnet RPC URL. Keep `CHAINLINK_AGENTS_GATEWAY_URL="https://agents.chain.link"` unless Chainlink provides a different gateway URL.

The example `PRIVATE_KEY` is Anvil's default first account. It is public and should only be used on a local fork.

Start the fork in terminal 1:

```shell
npm run fork
```

In terminal 2, seed the demo wallet:

```shell
npm run seed
```

In terminal 3, start OpenClaw from this repo so `!` shell commands and `.env` resolution use the correct working directory:

```shell
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
Using the portfolio allocation you calculated in Step 2, prepare a rebalance plan.

Important boundary:
- Price source: use only the Chainlink for Agents prices from Step 1.
- Portfolio state source: use only the local fork balances from Step 2.
- This is a calculation-only step.
- Do not query Uniswap.
- Do not execute any transaction.

Target allocation:
- WETH 50%
- WBTC 30%
- USDC 20%

Rebalance threshold: 5 percentage points.

If any asset is more than 5 percentage points away from target:
- identify which asset is overweight
- identify which asset is underweight
- calculate the approximate USD amount to move
- estimate the sell token amount using the Step 1 prices
- explain why this move improves the allocation

If the portfolio is within threshold, say no rebalance is needed.
```

### Step 4: Ask Chainlink Guardrails To Build The Swap JSON

Only after the Step 3 plan looks correct, ask OpenClaw to use Chainlink for Agents in guardrailed mode as a transaction/calldata builder. This step should return only the JSON produced by Chainlink. Do not quote through the local fork, simulate, submit, or execute.

```text
Use Chainlink for Agents in guardrailed mode as a transaction/calldata builder.
Return only the final JSON produced by Chainlink.

Use the Step 3 rebalance plan:
- sell token: <sell token from Step 3>
- buy token: <buy token from Step 3>
- amount in: <sell amount from Step 3, converted to token_in smallest units>
- max slippage: 50 bps

Token addresses:
- WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
- WBTC: 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
- USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

Workflow:
1. Discover the Ethereum mainnet chain_selector if needed with `GET /v1/networks`.
2. Fetch `GET /v1/catalog/token-swap`.
3. Build with `POST /v1/operations/token-swap` using:
   {
     "params": {
       "chain_selector": "<ethereum-mainnet-chain-selector>",
       "token_in": "<sell token address>",
       "token_out": "<buy token address>",
       "amount_in": "<amount in token_in smallest units>",
       "max_slippage_bps": 50
     }
   }
4. If Chainlink returns `operation_id`, poll `GET /v1/operations/{operation_id}` until generated transaction data is present.

Safety:
- Use Ethereum mainnet as the builder target because my local fork is forked from Ethereum mainnet.
- Do not use Base, Arbitrum, Sepolia, or any testnet for the builder.
- Do not run npm scripts or use the local fork in this step.
- Do not execute, simulate, validate, submit, or broadcast.
- Do not call `/direct` or `/submit`.
- Never expose or print private keys.
- If HTTP 402 is returned, handle x402 payment only for this builder/API call.
- If `token-swap` is unavailable, return only Chainlink's exact JSON error.
```

### Step 5: Execute Only After Confirmation

After reviewing the Chainlink builder JSON, send a new prompt:

```text
Execute the transaction JSON from Step 4 on the local fork only.

Important boundary:
- Execute only on the local fork at FORK_RPC_URL from .env.
- Use the fork-only PRIVATE_KEY from .env.
- Do not send any transaction to real mainnet.
- Do not use AGENT_PRIVATE_KEY for the Uniswap swap.
- Do not run npm scripts for this step.
- Do not call Chainlink `/submit`.
- Do not use Chainlink `/direct`.

Use only the transaction/calldata fields returned in the Chainlink JSON from Step 4.

Before sending to the fork:
- verify the transaction `to`, calldata, value, and token addresses from the JSON
- verify the transaction targets Ethereum mainnet addresses as copied into the local fork
- check and approve token allowance on the local fork only if the generated transaction requires prior ERC-20 approval and the allowance is insufficient

After execution:
- show the transaction hash
- confirm this was sent only to FORK_RPC_URL
- read the fork balances again
- summarize the updated allocation

Ask me for final confirmation before sending the transaction.
```

This keeps Chainlink for Agents prices, portfolio calculation, rebalance planning, and guardrailed transaction JSON generation agent-visible while still keeping final execution explicit and fork-only. OpenClaw remains useful as the operator and explainer, while Chainlink for Agents provides the runtime gateway for verified pricing data and guarded transaction building.

## Configuration

Important environment variables:

- `MAINNET_RPC_URL`: RPC used by Anvil to fork Ethereum mainnet.
- `FORK_RPC_URL`: Local fork RPC, default `http://127.0.0.1:8545`.
- `CHAINLINK_AGENTS_GATEWAY_URL`: Chainlink for Agents gateway, default `https://agents.chain.link`.
- `AGENT_PRIVATE_KEY`: Chainlink for Agents signer key used by the agent/skill for gateway registration and signing.
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

Use these commands on EC2:

- `npm run fork`: Start the local Anvil mainnet fork.
- `npm run seed`: Seed the fork wallet with ETH gas and test token balances.
- `npm run agents:skills`: Fetch the Chainlink for Agents gateway skill from `/v1/skills`.

## Validation

Run TypeScript checks:

```shell
npm run check
```

## Demo Talking Points

- OpenClaw uses Chainlink for Agents during the live price-read step, so the agent demonstrates a runtime gateway flow instead of only using a development skill.
- Chainlink for Agents can provide verified pricing through Data Streams with agent registration and x402 payments; direct Data Feed contracts remain a local fallback.
- Portfolio valuation and rebalance planning happen in separate prompts, making the decision process explicit and auditable.
- The seed script prepares fork-only test balances; OpenClaw performs portfolio reasoning and then asks Chainlink guardrails to build the swap JSON.
- The returned Chainlink JSON is applied only to the local fork after explicit confirmation.
- Dry-run mode, slippage, stale-price checks, and fork-only execution are the core safety boundaries.

## Local vs Server

If OpenClaw cannot run on your local machine, treat an AWS EC2 Ubuntu instance as the runtime environment for this demo. Running the agent on EC2 also keeps the agent away from your local filesystem and local environment variables.

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
- Use the interactive OpenClaw prompts above.

Recommended flow:

```text
Local Cursor repo
  -> git push
  -> AWS EC2 git pull
  -> OpenClaw + Anvil + npm scripts run on EC2
```

Do not run Anvil locally while OpenClaw runs on EC2 unless you also configure SSH port forwarding. The simplest setup is to keep the repo, OpenClaw, Anvil, and demo commands all on the same EC2 instance.

## AWS EC2 Setup

### Create The EC2 Instance

In the AWS Console:

For cost-sensitive defaults, see [AWS Low-Cost Setup](#aws-low-cost-setup) before launching the instance.

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

Cost control checklist:

- Do not use Elastic Load Balancer.
- Do not allocate an Elastic IP unless you need a stable IP.
- Stop the EC2 instance when pausing the demo.
- Terminate the EC2 instance when finished.
- Confirm the EBS volume is deleted after termination.
- Set an AWS Billing Alert before experimenting.

When the instance is stopped, EC2 compute charges stop, but EBS storage and public IPv4-related charges can continue. Termination is the cleanest way to stop all demo infrastructure costs.
