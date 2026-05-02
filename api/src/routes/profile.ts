import { Router } from "express";
import db from "../db.js";

const router = Router();

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
 *         description: ENS subdomain label (e.g. "alice" for alice.agentic.eth)
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

  const row = db
    .prepare("SELECT status, data_json FROM profiles WHERE ens_name = ?")
    .get(ensName) as { status: string; data_json: string } | undefined;

  if (!row) {
    return res.json({ status: "not_found", ensName });
  }

  const profile = row.data_json ? JSON.parse(row.data_json) : null;

  if (row.status === "pending") {
    return res.json({
      status: "pending",
      ensName,
      message: "Name claimed — waiting for metadata transaction to confirm",
    });
  }

  return res.json({ status: "registered", ensName, profile });
});

export default router;
