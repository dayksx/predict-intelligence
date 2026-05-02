import { Router } from "express";
import db from "../db.js";

const router = Router();

const POLYMARKET_FETCH_LIMIT = process.env.POLYMARKET_FETCH_LIMIT ?? "200";
const GRAPHITI_URL = process.env.GRAPHITI_URL ?? "http://localhost:8000";

/**
 * @openapi
 * /perceive:
 *   get:
 *     summary: Returns monitored data sources for the Perceive table
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: List of monitored sources
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sources:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MonitoredSource'
 */
router.get("/", (_req, res) => {
  const latest = db
    .prepare("SELECT MAX(updated_at) as ts FROM market_registry")
    .get() as { ts: string | null };

  const lastFetchAt = latest?.ts ?? new Date().toISOString();

  res.json({
    sources: [
      {
        id: "src-polymarket",
        sourceName: "Polymarket Gamma API",
        watchFrequency: "Every 24 hours",
        lastFetchAt,
        lastFetchUri: `https://gamma-api.polymarket.com/markets?closed=false&limit=${POLYMARKET_FETCH_LIMIT}`,
      },
      {
        id: "src-graphiti",
        sourceName: "Graphiti Knowledge Graph",
        watchFrequency: "After each market fetch",
        lastFetchAt,
        lastFetchUri: GRAPHITI_URL,
      },
      {
        id: "src-ens",
        sourceName: "ENS Sepolia Subgraph",
        watchFrequency: "Every 1 minute",
        lastFetchAt,
        lastFetchUri:
          "https://api.studio.thegraph.com/query/49574/enssepolia/version/latest",
      },
    ],
  });
});

export default router;
