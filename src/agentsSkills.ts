import { fetchChainlinkAgentsSkills } from "./agentsGateway.js";
import { loadConfig } from "./config.js";

async function main() {
  const config = loadConfig();
  const skillMarkdown = await fetchChainlinkAgentsSkills(config);
  console.log(skillMarkdown);
}

main().catch((error) => {
  console.error("\nChainlink for Agents skill fetch failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
