import { fetchChainlinkAgentsSkills } from "./agentsGateway.js";

const DEFAULT_CHAINLINK_AGENTS_GATEWAY_URL = "https://agents.chain.link";

async function main() {
  const gatewayUrl =
    process.env.CHAINLINK_AGENTS_GATEWAY_URL ??
    DEFAULT_CHAINLINK_AGENTS_GATEWAY_URL;
  const skillMarkdown = await fetchChainlinkAgentsSkills(gatewayUrl);
  console.log(skillMarkdown);
}

main().catch((error) => {
  console.error("\nChainlink for Agents skill fetch failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
