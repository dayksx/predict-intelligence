import { Router } from "express";
import { getDb } from "../db.js";

const router = Router();

type TriggerKind = "swap" | "prediction_market" | "onchain" | "bridge" | "other";

function actionToKind(action: string): TriggerKind {
  if (action === "swap") return "swap";
  if (action === "trade" || action === "close_position") return "prediction_market";
  return "other";
}

/**
 * @openapi
 * /act/{label}:
 *   get:
 *     summary: Returns executed actions for the Triggered / Act table
 *     tags: [Dashboard]
 *     parameters:
 *       - in: path
 *         name: label
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of triggered actions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 actions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TriggeredAction'
 */
router.get("/:label", (req, res) => {
  const ensName = `${req.params.label}.agentic.eth`;

  const result = getDb().exec(
    `SELECT run_id, data_json, timestamp
     FROM audit_log
     WHERE ens_name = ? AND event = 'action_executed'
     ORDER BY id DESC LIMIT 50`,
    [ensName],
  );

  const rows = (result[0]?.values ?? []) as Array<[string, string, string]>;

  const actions = rows.map(([run_id, data_json, timestamp]) => {
    const data = JSON.parse(data_json ?? "{}") as {
      decision?: {
        action?: string;
        marketId?: string;
        direction?: string;
        sizeUsdc?: number;
        tokenIn?: string;
        tokenOut?: string;
        reasoning?: string;
      };
      result?: {
        success?: boolean;
        dryRun?: boolean;
        txHash?: string;
        decisionId?: string;
      };
    };

    const decision = data.decision ?? {};
    const result2 = data.result ?? {};
    const action = decision.action ?? "other";
    const dryRun = result2.dryRun ?? true;

    let label = "Agent action";
    if (action === "trade") {
      label = `${decision.direction ?? "BUY"} ${decision.marketId ?? "market"} · $${decision.sizeUsdc ?? "?"} USDC`;
    } else if (action === "close_position") {
      label = `Close position on ${decision.marketId ?? "market"}`;
    } else if (action === "swap") {
      label = `${decision.tokenIn ?? "?"} → ${decision.tokenOut ?? "?"} · $${decision.sizeUsdc ?? "?"} USDC`;
    }

    const txHash = result2.txHash as string | undefined;

    return {
      id: `trg-${result2.decisionId ?? timestamp}`,
      kind: actionToKind(action),
      label,
      occurredAt: timestamp,
      primaryUrl: txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : undefined,
      primaryUrlLabel: txHash ? "Sepolia Etherscan" : undefined,
      extraDetail:
        [dryRun ? "Dry run" : null, result2.success === false ? "Failed" : null, decision.reasoning ?? null]
          .filter(Boolean)
          .join(" · ") || undefined,
    };
  });

  res.json({ actions });
});

export default router;
