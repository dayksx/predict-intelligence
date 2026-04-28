// POST episodes to the Graphiti service so agents can query them via RAG
export async function ingestEpisodes(episodes: string[]): Promise<void> {
  console.log(`[graphiti] would ingest ${episodes.length} episodes`);
}
