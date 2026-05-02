import { Router } from "express";
import { getDb } from "../db.js";

const router = Router();

/**
 * @openapi
 * /profile:
 *   get:
 *     summary: Returns all registered user profiles (used by ai module)
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Array of registered profiles
 */
router.get("/", (req, res) => {
  const result = getDb().exec(
    "SELECT ens_name, agent_id, data_json FROM profiles WHERE status = 'registered' AND data_json IS NOT NULL",
  );

  const rows = (result[0]?.values ?? []) as [string, string | null, string][];
  const profiles = rows
    .map(([ens_name, agentId, data_json]) => {
      try {
        return { ensName: ens_name, agentId: agentId ?? null, ...JSON.parse(data_json) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  res.json({ profiles });
});

/**
 * @openapi
 * /profile/{label}:
 *   get:
 *     summary: Returns registration status and profile for a user
 *     tags: [Dashboard]
 *     parameters:
 *       - in: path
 *         name: label
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Profile status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProfileResponse'
 */
router.get("/:label", (req, res) => {
  const ensName = `${req.params.label}.agentic.eth`;

  const result = getDb().exec(
    "SELECT status, agent_id, data_json FROM profiles WHERE ens_name = ?",
    [ensName],
  );

  const row = result[0]?.values[0] as [string, string | null, string] | undefined;

  if (!row) {
    return res.json({ status: "not_found", ensName });
  }

  const [status, agentId, data_json] = row;
  const profile = data_json ? JSON.parse(data_json) : null;

  if (status === "pending") {
    return res.json({
      status: "pending",
      ensName,
      agentId: agentId ?? null,
      message: "Name claimed — waiting for metadata transaction to confirm",
    });
  }

  return res.json({ status: "registered", ensName, agentId: agentId ?? null, profile });
});

export default router;
