import { formatUnits, type PublicClient } from "viem";
import { aggregatorV3Abi } from "./abi.js";
import { TOKENS, type TokenSymbol } from "./addresses.js";

export type PriceQuote = {
  symbol: TokenSymbol;
  feedDescription: string;
  priceUsd: number;
  decimals: number;
  updatedAt: Date;
};

export async function readTokenPrice(
  publicClient: PublicClient,
  symbol: TokenSymbol,
  stalePriceSeconds: number,
): Promise<PriceQuote> {
  const token = TOKENS[symbol];

  const [feedDecimals, description, roundData] = await Promise.all([
    publicClient.readContract({
      address: token.feed,
      abi: aggregatorV3Abi,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: token.feed,
      abi: aggregatorV3Abi,
      functionName: "description",
    }),
    publicClient.readContract({
      address: token.feed,
      abi: aggregatorV3Abi,
      functionName: "latestRoundData",
    }),
  ]);

  const [, answer, , updatedAt, answeredInRound] = roundData;
  if (answer <= 0n) {
    throw new Error(`${symbol} Chainlink feed returned a non-positive price.`);
  }
  if (answeredInRound === 0n) {
    throw new Error(`${symbol} Chainlink feed returned an invalid round.`);
  }

  const updatedAtSeconds = Number(updatedAt);
  const ageSeconds = Math.floor(Date.now() / 1000) - updatedAtSeconds;
  if (ageSeconds > stalePriceSeconds) {
    throw new Error(
      `${symbol} Chainlink price is stale: ${ageSeconds}s old, max ${stalePriceSeconds}s.`,
    );
  }

  return {
    symbol,
    feedDescription: description,
    priceUsd: Number(formatUnits(answer, feedDecimals)),
    decimals: feedDecimals,
    updatedAt: new Date(updatedAtSeconds * 1000),
  };
}

export async function readAllPrices(
  publicClient: PublicClient,
  symbols: TokenSymbol[],
  stalePriceSeconds: number,
) {
  const prices = await Promise.all(
    symbols.map((symbol) =>
      readTokenPrice(publicClient, symbol, stalePriceSeconds),
    ),
  );

  return Object.fromEntries(
    prices.map((price) => [price.symbol, price]),
  ) as Record<TokenSymbol, PriceQuote>;
}
