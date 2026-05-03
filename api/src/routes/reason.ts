import { Router } from "express";
import { getDb } from "../db.js";

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

  const result = getDb().exec(
    `SELECT run_id, event, data_json, timestamp
     FROM audit_log
     WHERE ens_name = ? AND event = 'run_complete'
     ORDER BY id DESC LIMIT 20`,
    [ensName],
  );

  const rows = (result[0]?.values ?? []) as Array<[string, string, string, string]>;

  const runs = rows
    .map(([run_id, , data_json, timestamp]) => {
      const data = JSON.parse(data_json ?? "{}") as {
        summary?: string;
        decisions?: Array<{ reasoning?: string; action?: string }>;
        results?: Array<{ success?: boolean; action?: string; dryRun?: boolean }>;
      };
      const decisions = (data.decisions ?? []).filter(
        (d) => d.action && d.action !== "hold",
      );

      // Skip runs where no real action was taken
      if (decisions.length === 0) return null;

      // Skip runs where every action failed (execution error, not just dry-run)
      const results = data.results ?? [];
      const anySucceeded = results.some((r) => r.success === true);
      const anyAttempted = results.length > 0;
      if (anyAttempted && !anySucceeded) return null;

      const focusAreas = [
        ...new Set(
          decisions.map((d) =>
            d.action === "trade"
              ? "Prediction market"
              : d.action === "swap"
                ? "Swap"
                : d.action === "close_position"
                  ? "Position close"
                  : "Analysis",
          ),
        ),
      ];

      return {
        id: `rsn-${run_id ?? timestamp}`,
        decidedAt: timestamp,
        summary: data.summary ?? "Run complete",
        focusAreas,
        promptAlignment: `${decisions.length} action(s) triggered`,
      };
    })
    .filter(Boolean);

  res.json({ runs });
});

export default router;
