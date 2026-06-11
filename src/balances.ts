import { formatUnits, type Address, type PublicClient } from "viem";
import { erc20Abi } from "./abi.js";
import { TOKENS, type TokenSymbol } from "./addresses.js";

export type TokenBalance = {
  symbol: TokenSymbol;
  address: Address;
  raw: bigint;
  decimals: number;
  amount: number;
};

export async function readTokenBalance(
  publicClient: PublicClient,
  owner: Address,
  symbol: TokenSymbol,
): Promise<TokenBalance> {
  const token = TOKENS[symbol];
  const [raw, decimals] = await Promise.all([
    publicClient.readContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    }),
    publicClient.readContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "decimals",
    }),
  ]);

  return {
    symbol,
    address: token.address,
    raw,
    decimals,
    amount: Number(formatUnits(raw, decimals)),
  };
}

export async function readAllBalances(
  publicClient: PublicClient,
  owner: Address,
  symbols: TokenSymbol[],
) {
  const balances = await Promise.all(
    symbols.map((symbol) => readTokenBalance(publicClient, owner, symbol)),
  );

  return Object.fromEntries(
    balances.map((balance) => [balance.symbol, balance]),
  ) as Record<TokenSymbol, TokenBalance>;
}
