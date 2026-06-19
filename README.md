# OpenClaw + Chainlink for Agents Use cases
> **NOTE:** This repo represents an educational example to use a Chainlink system, product, or service and is provided to demonstrate how to interact with Chainlink’s systems, products, and services to integrate them into your own. This template is provided “AS IS” and “AS AVAILABLE” without warranties of any kind, it has not been audited, and it may be missing key checks or error handling to make the usage of the system, product or service more clear. Do not use the code in this example in a production environment without completing your own audits and application of best practices. Neither Chainlink Labs, the Chainlink Foundation, nor Chainlink node operators are responsible for unintended outputs that are generated due to errors in code.

The repository is used to provide guide to use [Chainlink for Agents](https://docs.chain.link/resources/chainlink-for-agents) with AI Agent. There are 3 demos for users try SVA and guardrailed experiences from Chainlink for Agents. Openclaw is the AI agent used for use cases in the demo, while Chainlink for Agents can be installed with other AI agents. 

## prerequisite
- Install Openclaw following the [official doc](https://openclaw.ai/).
- [Install Chainlink for Agents](#install-chainlink-for-agents-skill) on Openclaw. 

## Use Case 1: Treasury Yield Optimization
This demo shows how to use Openclaw AI agent to complete the Treasury Yield Optimization. The agent will monitor all idle assets in the SVA address and supply these assets to Aave on Base mainnet.

### Step 1: Create a SVA for the agent
Transfer 5-10 $USDC tokens to your EOA account, and open the agent with command:
```shell
openclaw chat
```
Input prompt
```text
Use chainlink-for-agent to create a SVA on Base mainnet. Approve 1 USDC to pay with x402 for Base SVA creation  if it is necessary. 
```
You will see SVA address returned by Chainlink gateway and 1 USDC paid with X402. 

### Step 2: Monitor idle funds with `token-balance`
Transfer a small amount of $USDC and $WETH tokens(or any other ERC20 tokens) to the SVA address and then check the balance with the prompt.
```text
Use Chainlink for Agents `token-balance` workflow to check my SVA’s balance for idle tokens on Base Mainnet.

Return:
  - SVA wallet address
  - token symbol/name if available
  - raw balance
  - human-readable balance
  - any workflow operation ID/status
  - any errors or unavailable data
 
```
You will see the balances and operation ID for `token-balance` workflow. 

### Step 3: Check Aave yield opportunities with `aave-yield`
Input prompt
```text
Use the Chainlink for Agents aave-yields workflow to check the current Aave yield opportunity for my idle tokens on Base Mainnet.

Return only the relevant yield info for all idle assets:
- Aave market/reserve name
- underlying token symbol/name/address
- current supply APY
- any minimum amount, liquidity, or protocol constraints if available
- x402 fee
- any errors or unavailable data
Do not submit any Aave supply transaction, sign operation data for deployment, move wallet assets, or check unrelated assets.
```
Agent is expected to return current supply APY for idle assets. 

### Step 4: Prepare and send supply transaction with `aave-supply`
```text
Use Chainlink for Agents `aave-supply` workflow to supply all idle supported assets from my Base Mainnet SVA into Aave V3 Base.


Use only the `aave-supply` workflow. This is a write operation that may approve tokens and supply assets into Aave, so before signing or submitting any EIP-712 operation, show me for each asset:                                                            
  - current token balance
  - amount to supply, raw and human-readable
  - Aave market/pool address
  - token contract address
  - workflow operation ID
  - generated transactions/calldata summary
  - whether approval is required
  - expected x402 fee
  - any errors or unavailable data


Wait for my explicit confirmation before signing or submitting any operation.                                                 


After confirmation, submit each asset supply operation only if:
  - the token balance is still nonzero
  - the token is supported by Aave V3 Base
  - the workflow status is pending signature / ready for submission


Return:
  - operation ID and status for each asset
  - transaction hash if submitted
  - final status
  - final idle balances if available
  - any errors or unavailable data
```
The agent is expected to receive the operatios and decod calldata within it and ask for your confirmation. Input the prompt to approve the submission.
```text
Confirm: sign and submit these 2 operations. 
```
After confirmation, the transaction will be signed and submitted to the Chainlink Gateway. This is the result returned by the agent. 

### Step 5: Check the aave positions with `aave-postions`
Check the current aave positions for your SVA with prompt.
```text
Use Chainlink for Agents `aave-positions` workflow to check my Aave V3 positions for my Base Mainnet SVA.


Use only the read-only `aave-positions` workflow. Do not submit transactions, sign operation data, approve tokens, supply, withdraw, swap, bridge, or move any assets.


Return:
  - workflow operation ID and status
  - Aave market/pool address
  - supplied assets / aToken positions
  - underlying token symbol/name/address
  - supplied raw balance
  - human-readable supplied balance
  - current supply APY if available
  - collateral/enabled status if available
  - x402 fee
  - any errors or unavailable data

```
Agent is exptected to return the aave positions for your SVA address. 

### Step 6: Withdraw the fund from Aave to SVA with `aave-withdraw`
Withdraw the aToken from Aave to your SVA with prompt.
```text
 Use Chainlink for Agents `aave-withdraw` workflow to withdraw my Aave V3 Base positions back to my Base Mainnet SVA.

 This is a write operation. Before signing or submitting any EIP-712 operation, show me for each asset:
  - current Aave supplied position
  - underlying token symbol/name/address
  - withdraw amount, raw and human-readable if available
  - Aave market/pool address
  - workflow operation ID
  - generated transaction/calldata summary
  - expected x402 fee
  - any errors or unavailable data

 Wait for my explicit confirmation before signing or submitting.

  Return:
  - operation ID and status for each asset
  - transaction hash if submitted
  - final idle token balances if available
  - any errors or unavailable data
```
Check the balance of tokens in SVA idle asset tokens should be there. 

### Step 7: Withdraw the fund from SVA to EOA with `token-transfer`
Withdraw the idle asset tokens from SVA to your EOA with prompt.
```text
  Use the Chainlink for Agents 'token-transfer workflow to withdraw all idle assets from my Base Mainnet SVA back to my EOA <USE YOUR EOA ADDRESS HERE>.
                 
  Before signing or submitting any EIP-712 operation:
  - check current token balances for each idle asset
  - prepare `token-transfer` operations for all nonzero supported idle assets
  - show me for each asset:
    - transfer amount, raw and human-readable
    - workflow operation ID
    - generated transaction/calldata summary
    - expected x402 fee
    - any errors or unavailable data

  Wait for my explicit confirmation before signing or submitting.

  Return:
  - operation ID and status for each asset
  - submission status for each asset
  - transaction hash if available
  - final SVA token balances if available
  - final EOA received balances or transfer events if available
  - any errors or unavailable data
```
Check the balance of tokens in your EOA. 

## Use Case 2: Portfolio Rebalancing Demo

This demo shows an AI-agent-style portfolio rebalance loop using Chainlink for Agents for price discovery and a local Ethereum mainnet fork for deterministic Uniswap execution.

The agent monitors `WETH / WBTC / USDC`, values the portfolio with verified pricing data from the Chainlink for Agents gateway, checks target allocation drift, and optionally executes a Uniswap V3 swap on the fork.

Default target:

- `WETH`: 50%
- `WBTC`: 30%
- `USDC`: 20%
- Rebalance threshold: 5 percentage points

### Step 1: Retrieve Price Data and inspect current SVA portfolio allocation
Transfer any amount of WETH, WBTC and USDC to SVA address you creatd in use case 1. 

Query the price of assets and inspect allocation for your SVA with prompt.

```text
  Use Chainlink for Agents to inspect my SVA portfolio and calculate current allocation.

  Steps:
  1. Use the token-balance workflow to check balances for these assets: WETH, WBTC and USDC
  2. Use token-info to confirm token decimals and symbols.
  3. Fetch price data from Chainlink Data Streams using streams-latest-report or streams-bulk-reports:
     - ETH/USD price for WETH
     - BTC/USD price for WBTC
     - USDC/USD price for USDC

  Target allocation:
  - WETH: 50%
  - WBTC: 30%
  - USDC: 20%

  Output:
  1. SVA wallet address.
  2. Token balances in raw units and human-readable units.
  3. Chainlink Data Streams price used for each asset.
  4. USD value of each asset.
  5. Total portfolio USD value.
  6. Current allocation percentage for each asset.
  7. Difference from target allocation for each asset.

  Do not generate swaps or transactions yet. This prompt is only for balance checking, pricing, and allocation calculation.
```

Expected agent behavior:
- Use Chainlink for Agents/Data Streams for price discovery.
- Return prices and freshness checks before moving on.
- Use price and balance to inspect the current allocation to provide a report. 

### Step 2: Rebalance with `token-swap`
Use the workflow `token-swap` to ask Chainlink gateway to generate operations with prompt.
```text
 Use Chainlink for Agents to rebalance-plan my Base SVA portfolio, then compose swaps only.

 Target:
  - WETH 50%
  - WBTC 30%
  - USDC 20%
 
  Threshold: rebalance only if >5 percentage points from target.

 Steps:
  1. Use the asset allocation in the last step. 
  2. Compose required swaps with `token-swap`:
     - `POST /v1/operations/token-swap`
     - params: `chain_selector`, `token_in`, `token_out`, `amount_in`, `max_slippage_bps`
     - use `max_slippage_bps: 50`
  3. Return plan + token-swap operation IDs/calldata summaries.
  4. Do not sign, submit, or broadcast anything without separate approval.
```

Expected agent behavior:

- Prepare the swap plan to reallocate the assets in SVA.
- Return multiple operations to you from Chainlink gateway.
- Wait for you to sign the message.

Sign the message with prompt
```text
Confirm and submit the operations.
```

Expected agent behavior:

- Submit operations to the Chainlink Gateway
- Reallocate assets by swapping them on Uniswap V3. 
- Report new asset allocation.


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


Chainlink for Agents is currently in Preview. Expect the agent to handle or ask you about:

- gateway registration
- signing Terms of Service with a local EVM wallet
- a Base wallet funded with USDC for x402 micropayments
- optional SVA provisioning for guardrailed onchain actions
- Data Streams feed IDs and endpoint details

For this demo, install only the Chainlink for Agents bundle above. Chainlink for Agents price retrieval happens through OpenClaw in Step 1, not through a local script.

## Local vs Server

If OpenClaw cannot run on your local machine, treat an AWS EC2 Ubuntu instance as the runtime environment for this demo. Running the agent on EC2 also keeps the agent away from your local filesystem and local environment variables. Check [AWS EC2 Setup](#aws-ec2-setup) to learn how to set up EC2 and install dependencies in the environment. 

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
