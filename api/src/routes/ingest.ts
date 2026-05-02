import { Router } from "express";
import db from "../db.js";

const router = Router();

/**
 * @openapi
 * /ingest/markets:
 *   post:
 *     summary: Upsert market registry entries (called by listener)
 *     tags: [Ingest]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [markets]
 *             properties:
 *               markets:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [market_id, title, domain, updated_at]
 *                   properties:
 *                     market_id: { type: string }
 *                     title: { type: string }
 *                     clob_yes_token_id: { type: string }
 *                     clob_no_token_id: { type: string }
 *                     neg_risk: { type: boolean }
 *                     resolution_date: { type: string }
 *                     domain: { type: string }
 *                     updated_at: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Markets upserted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 upserted: { type: number }
 */
router.post("/markets", (req, res) => {
  const markets = req.body?.markets as Array<Record<string, unknown>>;
  if (!Array.isArray(markets)) {
    return res.status(400).json({ error: "markets array required" });
  }

  const upsert = db.prepare(`
    INSERT INTO market_registry (market_id, title, clob_yes_token_id, clob_no_token_id, neg_risk, resolution_date, domain, updated_at)
    VALUES (@market_id, @title, @clob_yes_token_id, @clob_no_token_id, @neg_risk, @resolution_date, @domain, @updated_at)
    ON CONFLICT(market_id) DO UPDATE SET
      title = excluded.title,
      clob_yes_token_id = excluded.clob_yes_token_id,
      clob_no_token_id = excluded.clob_no_token_id,
      neg_risk = excluded.neg_risk,
      resolution_date = excluded.resolution_date,
      domain = excluded.domain,
      updated_at = excluded.updated_at
  `);

  const batchUpsert = db.transaction((rows: Array<Record<string, unknown>>) => {
    for (const m of rows) {
      upsert.run({ ...m, neg_risk: m.neg_risk ? 1 : 0 });
    }
  });

  batchUpsert(markets);
  res.json({ upserted: markets.length });
});

/**
 * @openapi
 * /ingest/profiles:
 *   post:
 *     summary: Upsert a user profile (called by listener on ENS registration)
 *     tags: [Ingest]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ensName, profile]
 *             properties:
 *               ensName: { type: string, example: "alice.agentic.eth" }
 *               status: { type: string, enum: [registered, pending], default: registered }
 *               profile: { type: object, description: TradingStrategy JSON }
 *     responses:
 *       200:
 *         description: Profile upserted
 */
router.post("/profiles", (req, res) => {
  const { ensName, status = "registered", profile } = req.body as {
    ensName?: string;
    status?: string;
    profile?: unknown;
  };

  if (!ensName) return res.status(400).json({ error: "ensName required" });

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO profiles (ens_name, status, data_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(ens_name) DO UPDATE SET
      status = excluded.status,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `).run(ensName, status, JSON.stringify(profile ?? null), now, now);

  res.json({ ok: true, ensName, status });
});

/**
 * @openapi
 * /ingest/audit:
 *   post:
 *     summary: Append an audit log entry (called by ai module)
 *     tags: [Ingest]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ensName, event, timestamp]
 *             properties:
 *               ensName: { type: string }
 *               runId: { type: string }
 *               event: { type: string }
 *               data: { type: object }
 *               timestamp: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Entry appended
 */
router.post("/audit", (req, res) => {
  const { ensName, runId, event, data, timestamp } = req.body as {
    ensName?: string;
    runId?: string;
    event?: string;
    data?: unknown;
    timestamp?: string;
  };

  if (!ensName || !event) {
    return res.status(400).json({ error: "ensName and event required" });
  }

  db.prepare(`
    INSERT INTO audit_log (ens_name, run_id, event, data_json, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(ensName, runId ?? null, event, JSON.stringify(data ?? null), timestamp ?? new Date().toISOString());

  res.json({ ok: true });
});

/**
 * @openapi
 * /ingest/positions:
 *   post:
 *     summary: Upsert a position (called by ai module)
 *     tags: [Ingest]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ensName, position]
 *             properties:
 *               ensName: { type: string }
 *               position:
 *                 type: object
 *                 required: [id, status]
 *                 properties:
 *                   id: { type: string }
 *                   status: { type: string, enum: [open, closed] }
 *     responses:
 *       200:
 *         description: Position upserted
 */
router.post("/positions", (req, res) => {
  const { ensName, position } = req.body as {
    ensName?: string;
    position?: Record<string, unknown>;
  };

  if (!ensName || !position?.id) {
    return res.status(400).json({ error: "ensName and position.id required" });
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO positions (position_id, ens_name, status, data_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(position_id) DO UPDATE SET
      status = excluded.status,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `).run(
    position.id as string,
    ensName,
    (position.status as string) ?? "open",
    JSON.stringify(position),
    now,
    now,
  );

  res.json({ ok: true });
});

export default router;
