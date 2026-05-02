import { Router } from "express";
import db from "../db.js";

const router = Router();

/**
 * @openapi
 * /reason/{label}:
 *   get:
 *     summary: Returns agent reasoning runs for the Reason table
 *     tags: [Dashboard]
 *     parameters:
 *       - in: path
 *         name: label
 *         required: true
 *         schema: { type: string }
 *         description: ENS subdomain label (e.g. "alice" for alice.agentic.eth)
 *     responses:
 *       200:
 *         description: List of reasoning run records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 runs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReasonRecord'
 */
router.get("/:label", (req, res) => {
  const ensName = `${req.params.label}.agentic.eth`;

  const rows = db
    .prepare(
      `SELECT run_id, event, data_json, timestamp
       FROM audit_log
       WHERE ens_name = ? AND event = 'run_complete'
       ORDER BY id DESC
       LIMIT 20`,
    )
    .all(ensName) as Array<{
    run_id: string;
    event: string;
    data_json: string;
    timestamp: string;
  }>;

  const runs = rows.map((row) => {
    const data = JSON.parse(row.data_json ?? "{}") as {
      summary?: string;
      decisions?: Array<{ reasoning?: string; action?: string }>;
    };

    const decisions = data.decisions ?? [];
    const focusAreas = [
      ...new Set(
        decisions
          .filter((d) => d.action && d.action !== "hold")
          .map((d) =>
            d.action === "trade"
              ? "Prediction market"
              : d.action === "swap"
                ? "Swap"
                : d.action === "close_position"
                  ? "Position close"
                  : "Hold",
          ),
      ),
    ];

    return {
      id: `rsn-${row.run_id ?? row.timestamp}`,
      decidedAt: row.timestamp,
      summary: data.summary ?? "Run complete — no summary recorded",
      focusAreas: focusAreas.length > 0 ? focusAreas : ["Analysis"],
      promptAlignment:
        decisions.length > 0
          ? `${decisions.length} decision(s) evaluated — ${decisions.filter((d) => d.action === "trade" || d.action === "swap").length} action(s) triggered`
          : "No actionable decisions in this run",
    };
  });

  res.json({ runs });
});

export default router;
