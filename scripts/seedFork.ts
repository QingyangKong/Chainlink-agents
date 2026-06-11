import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseEther,
  parseUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { erc20Abi } from "../src/abi.js";
import { TOKENS, type TokenSymbol } from "../src/addresses.js";

const FORK_RPC_URL = process.env.FORK_RPC_URL ?? "http://127.0.0.1:8545";

const DEFAULT_WHALES: Record<TokenSymbol, Address> = {
  WETH: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
  WBTC: "0xcbcdf9626bc03e24f779434178a73a0b4bad62ed",
  USDC: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
};

const DEFAULT_SEED_AMOUNTS: Record<TokenSymbol, string> = {
  WETH: "20",
  WBTC: "0.05",
  USDC: "10000",
};

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(FORK_RPC_URL),
});

const walletClient = createWalletClient({
  chain: mainnet,
  transport: http(FORK_RPC_URL),
});

async function main() {
  const recipient = getRecipient();
  console.log(`Seeding fork portfolio ${recipient}`);

  await setEthBalance(recipient, parseEther("10"));

  for (const symbol of Object.keys(TOKENS) as TokenSymbol[]) {
    const whale = getWhale(symbol);
    const amount = parseUnits(
      process.env[`SEED_${symbol}`] ?? DEFAULT_SEED_AMOUNTS[symbol],
      TOKENS[symbol].decimals,
    );

    await impersonate(whale);
    await setEthBalance(whale, parseEther("10"));

    const whaleBalance = await publicClient.readContract({
      address: TOKENS[symbol].address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [whale],
    });
    if (whaleBalance < amount) {
      throw new Error(
        `${symbol} whale ${whale} has ${formatUnits(
          whaleBalance,
          TOKENS[symbol].decimals,
        )}, cannot transfer ${formatUnits(amount, TOKENS[symbol].decimals)}.`,
      );
    }

    const hash = await walletClient.writeContract({
      account: whale,
      address: TOKENS[symbol].address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    console.log(
      `- sent ${formatUnits(amount, TOKENS[symbol].decimals)} ${symbol} from ${whale}`,
    );
  }

  console.log("Seed complete.");
}

function getRecipient(): Address {
  if (process.env.PORTFOLIO_ADDRESS) {
    return normalizeAddress(process.env.PORTFOLIO_ADDRESS, "PORTFOLIO_ADDRESS");
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (privateKey) {
    const normalized = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    return privateKeyToAccount(normalized as `0x${string}`).address;
  }

  throw new Error("Set PORTFOLIO_ADDRESS or PRIVATE_KEY before seeding.");
}

function getWhale(symbol: TokenSymbol): Address {
  const value = process.env[`${symbol}_WHALE`] ?? DEFAULT_WHALES[symbol];
  return normalizeAddress(value, `${symbol}_WHALE`);
}

function normalizeAddress(value: string, label: string): Address {
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw new Error(`${label} must be a 0x-prefixed 20-byte hex address.`);
  }
  return trimmed.toLowerCase() as Address;
}

async function impersonate(address: Address) {
  await rpc("anvil_impersonateAccount", [address]);
}

async function setEthBalance(address: Address, balance: bigint) {
  await rpc("anvil_setBalance", [address, `0x${balance.toString(16)}`]);
}

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(FORK_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  const payload = (await response.json()) as { error?: { message: string } };
  if (payload.error) {
    throw new Error(`${method} failed: ${payload.error.message}`);
  }
}

main().catch((error) => {
  console.error("Seed failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
