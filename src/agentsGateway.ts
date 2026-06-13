export async function fetchChainlinkAgentsSkills(gatewayUrl: string) {
  const response = await fetch(new URL("/v1/skills", gatewayUrl));
  if (!response.ok) {
    throw new Error(
      `Chainlink for Agents skills request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
}
