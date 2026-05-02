import { Router } from "express";
import { getDb, persist } from "../db.js";

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

  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO market_registry (market_id, title, clob_yes_token_id, clob_no_token_id, neg_risk, resolution_date, domain, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(market_id) DO UPDATE SET
      title = excluded.title,
      clob_yes_token_id = excluded.clob_yes_token_id,
      clob_no_token_id = excluded.clob_no_token_id,
      neg_risk = excluded.neg_risk,
      resolution_date = excluded.resolution_date,
      domain = excluded.domain,
      updated_at = excluded.updated_at
  `);

  for (const m of markets) {
    stmt.run([
      String(m.market_id ?? ""),
      String(m.title ?? ""),
      m.clob_yes_token_id != null ? String(m.clob_yes_token_id) : null,
      m.clob_no_token_id  != null ? String(m.clob_no_token_id)  : null,
      m.neg_risk ? 1 : 0,
      m.resolution_date  != null ? String(m.resolution_date)  : null,
      m.domain           != null ? String(m.domain)           : null,
      String(m.updated_at ?? new Date().toISOString()),
    ]);
  }
  stmt.free();
  persist(db);

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
 *               ensName: { type: string }
 *               status: { type: string, enum: [registered, pending] }
 *               profile: { type: object }
 *     responses:
 *       200:
 *         description: Profile upserted
 */
router.post("/profiles", (req, res) => {
  const { ensName, status = "registered", profile, agentId } = req.body as {
    ensName?: string;
    status?: string;
    profile?: unknown;
    agentId?: string;
  };

  if (!ensName) return res.status(400).json({ error: "ensName required" });

  const db = getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO profiles (ens_name, status, agent_id, data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(ens_name) DO UPDATE SET
       status = excluded.status,
       agent_id = COALESCE(excluded.agent_id, profiles.agent_id),
       data_json = excluded.data_json,
       updated_at = excluded.updated_at`,
    [ensName, status, agentId ?? null, JSON.stringify(profile ?? null), now, now],
  );
  persist(db);

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

  const db = getDb();
  db.run(
    `INSERT INTO audit_log (ens_name, run_id, event, data_json, timestamp) VALUES (?, ?, ?, ?, ?)`,
    [ensName, runId ?? null, event, JSON.stringify(data ?? null), timestamp ?? new Date().toISOString()],
  );
  persist(db);

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

  const db = getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO positions (position_id, ens_name, status, data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(position_id) DO UPDATE SET
       status = excluded.status,
       data_json = excluded.data_json,
       updated_at = excluded.updated_at`,
    [
      position.id as string,
      ensName,
      (position.status as string) ?? "open",
      JSON.stringify(position),
      now,
      now,
    ],
  );
  persist(db);

  res.json({ ok: true });
});

export default router;
