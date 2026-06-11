# OpenClaw + Chainlink Portfolio Rebalancing Demo

This demo shows an AI-agent-style portfolio rebalance loop on a local Ethereum mainnet fork.

The agent monitors `WETH / WBTC / USDC`, values the portfolio with Chainlink Data Feeds, checks target allocation drift, and optionally executes a Uniswap V3 swap on the fork.

Default target:

- `WETH`: 50%
- `WBTC`: 30%
- `USDC`: 20%
- Rebalance threshold: 5 percentage points

## Why This Is Safe For A Demo

The project is designed for a local mainnet fork. It uses real mainnet contract addresses for Chainlink feeds, ERC20 tokens, and Uniswap, but transactions execute only against your forked node.

Do not use this code with a real mainnet private key. Keep `DRY_RUN=true` until you have inspected the quote and transaction plan.

## Components

- OpenClaw + Chainlink Skill: Interactive operator flow. Use this to ask for prices, inspect portfolio value, and decide whether to rebalance.
- Chainlink Data Feeds: Runtime price source for `ETH/USD`, `BTC/USD`, and `USDC/USD`.
- `src/feeds.ts`: Optional deterministic price reader. Useful for validation, but the interactive demo should first ask OpenClaw to read feeds directly.
- `src/balances.ts`: Optional deterministic balance reader.
- `src/allocation.ts`: Optional deterministic allocation calculator.
- `src/rebalance.ts`: Optional deterministic rebalance planner.
- `src/uniswap.ts`: Swap execution helper for the final rebalance step.
- `scripts/seedFork.ts`: Seeds a fork wallet by impersonating configured token holders.

The preferred demo path is interactive: OpenClaw reads prices and explains each step first. The TypeScript files are fallback execution tools, not the main story of the demo.

## Local vs Server

If OpenClaw cannot run on your local machine, treat an AWS EC2 Ubuntu instance as the runtime environment for this demo.

Run these tasks locally:

- Edit code in Cursor.
- Commit and push the repo to GitHub or another Git remote.
- SSH into the EC2 instance when you want to run the demo.

Run these tasks on the EC2 instance:

- Clone or pull this repo.
- Install Node.js, Foundry/Anvil, OpenClaw, and Chainlink Skill.
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

## Install Chainlink Skill

For this demo, install the Chainlink skill into OpenClaw first. This is the main path because OpenClaw is the agent that will read prices interactively.

If your OpenClaw version supports ClawHub skills:

```shell
openclaw skills install chainlink
openclaw skills list
```

Some OpenClaw builds use singular commands:

```shell
openclaw skill install chainlink
openclaw skill list
```

Optionally, also install the official Chainlink Agent Skills bundle at the project level:

```shell
npx skills add smartcontractkit/chainlink-agent-skills
```

The difference:

- `openclaw skills install chainlink` gives OpenClaw the Chainlink capability directly.
- `npx skills add smartcontractkit/chainlink-agent-skills` installs the official Chainlink skill bundle into the project for compatible Agent Skills tools.

For this demo, the OpenClaw install is the important one. Use the Chainlink Skill explicitly in OpenClaw when asking it to read prices. The point is to let the agent apply Chainlink-specific knowledge during the interaction, not only execute a prewritten script.

## Interactive OpenClaw Workflow

This is the recommended demo flow. Do not ask OpenClaw to complete everything in one prompt. Ask for one step at a time, inspect the answer, then continue.

### Step 1: Ask OpenClaw To Read Chainlink Prices

Prompt:

```text
Using /chainlink-data-feeds-skill, read the latest Chainlink Data Feed prices on my local Ethereum mainnet fork.

Use FORK_RPC_URL from .env.
Read these feeds:
- ETH/USD: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
- BTC/USD: 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c
- USDC/USD: 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6

For each feed:
- call decimals()
- call latestRoundData()
- convert answer using decimals
- check updatedAt freshness
- report the final USD price and timestamp

Only read and report prices. Do not read balances and do not rebalance yet.
```

Expected agent behavior:

- Use the Chainlink Skill to choose the correct AggregatorV3 read pattern.
- Use a direct RPC read, for example `cast call` or another OpenClaw-supported onchain read tool.
- Return prices and freshness checks before moving on.

### Step 2: Ask OpenClaw To Check Portfolio Value

Prompt:

```text
Now read my portfolio balances on the same fork and calculate whether the allocation matches the target.

Portfolio address: use PORTFOLIO_ADDRESS from .env.
Assets:
- WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
- WBTC: 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
- USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

Use the prices you just read from Chainlink.
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

- Read ERC20 `balanceOf()` and `decimals()` directly from the fork.
- Combine balances with the Chainlink prices from Step 1.
- Explain whether the portfolio is inside or outside the threshold.

### Step 3: Ask OpenClaw To Rebalance

Prompt:

```text
Based on the portfolio value and drift you calculated, prepare a rebalance transaction plan.

If any asset is more than 5 percentage points away from target:
- identify which asset to sell
- identify which asset to buy
- calculate the approximate USD amount to rebalance
- get a Uniswap V3 quote on the local fork
- show expected output, slippage, and pool fee tier

Do not execute yet. Ask me for confirmation first.
```

After reviewing the quote, send a new prompt:

```text
Execute the rebalance on the local fork using the plan you just showed me.
Use fork-only PRIVATE_KEY from .env.
After execution, show the transaction hash and then recalculate the portfolio allocation.
```

For the execution step, it is acceptable for OpenClaw to call the TypeScript helper:

```shell
npm run rebalance:execute
```

This keeps the risky transaction construction deterministic while preserving the interactive Chainlink Skill flow for price discovery and decision-making.

## Project Setup On EC2

```shell
git clone <YOUR_REPO_URL>
cd agents-learning
npm install
cp .env.example .env
```

Edit `.env` and set `MAINNET_RPC_URL` to an Ethereum mainnet RPC URL.

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

Then use the prompts in `Interactive OpenClaw Workflow`:

1. Ask OpenClaw to read Chainlink prices directly.
2. Ask OpenClaw to read balances and calculate portfolio value.
3. Ask OpenClaw to prepare a rebalance plan.
4. Confirm with a new prompt before execution.

The deterministic TypeScript path is still available as a validation fallback.

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

## Validation

Run TypeScript checks:

```shell
npm run check
```

## Demo Talking Points

- OpenClaw uses Chainlink Skill during the live price-read step, so the agent demonstrates Chainlink-specific behavior instead of only running a prewritten script.
- Chainlink Data Feeds provide the trusted price input; the agent must call `decimals()` and `latestRoundData()` and check freshness before using prices.
- Portfolio valuation and rebalance planning happen in separate prompts, making the decision process explicit and auditable.
- TypeScript helpers are fallback execution tools for deterministic swaps, not the primary price-discovery path.
- Uniswap performs the portfolio composition change after explicit confirmation.
- Dry-run mode, slippage, stale-price checks, and fork-only execution are the core safety boundaries.
