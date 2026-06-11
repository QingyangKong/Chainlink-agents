import type { Account, PublicClient, WalletClient } from "viem";
import { erc20Abi, quoterV2Abi, swapRouter02Abi } from "./abi.js";
import {
  TOKENS,
  UNISWAP_V3_QUOTER_V2,
  UNISWAP_V3_SWAP_ROUTER_02,
  type TokenSymbol,
} from "./addresses.js";

export type SwapQuote = {
  feeTier: number;
  amountOut: bigint;
  amountOutMinimum: bigint;
  gasEstimate: bigint;
};

export async function quoteBestSwap(
  publicClient: PublicClient,
  sell: TokenSymbol,
  buy: TokenSymbol,
  amountIn: bigint,
  preferredFeeTier: number,
  slippageBps: number,
): Promise<SwapQuote> {
  const feeTiers = unique([preferredFeeTier, 500, 3_000, 10_000]);
  const errors: string[] = [];

  for (const feeTier of feeTiers) {
    try {
      const { result } = await publicClient.simulateContract({
        address: UNISWAP_V3_QUOTER_V2,
        abi: quoterV2Abi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: TOKENS[sell].address,
            tokenOut: TOKENS[buy].address,
            amountIn,
            fee: feeTier,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const [amountOut, , , gasEstimate] = result;
      return {
        feeTier,
        amountOut,
        amountOutMinimum: applySlippage(amountOut, slippageBps),
        gasEstimate,
      };
    } catch (error) {
      errors.push(`${feeTier}: ${shortError(error)}`);
    }
  }

  throw new Error(`No Uniswap V3 pool quote succeeded. ${errors.join(" | ")}`);
}

export async function executeSwap(params: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  sell: TokenSymbol;
  buy: TokenSymbol;
  amountIn: bigint;
  quote: SwapQuote;
}) {
  const { publicClient, walletClient, account, sell, buy, amountIn, quote } =
    params;
  const tokenIn = TOKENS[sell].address;

  const allowance = await publicClient.readContract({
    address: tokenIn,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, UNISWAP_V3_SWAP_ROUTER_02],
  });

  if (allowance < amountIn) {
    const approveHash = await walletClient.writeContract({
      account,
      chain: undefined,
      address: tokenIn,
      abi: erc20Abi,
      functionName: "approve",
      args: [UNISWAP_V3_SWAP_ROUTER_02, amountIn],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const swapHash = await walletClient.writeContract({
    account,
    chain: undefined,
    address: UNISWAP_V3_SWAP_ROUTER_02,
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut: TOKENS[buy].address,
        fee: quote.feeTier,
        recipient: account.address,
        amountIn,
        amountOutMinimum: quote.amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
    value: 0n,
  });

  return publicClient.waitForTransactionReceipt({ hash: swapHash });
}

function applySlippage(amountOut: bigint, slippageBps: number) {
  return (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}

function unique(values: number[]) {
  return [...new Set(values)];
}

function shortError(error: unknown) {
  if (error instanceof Error) return error.message.split("\n")[0];
  return String(error);
}
