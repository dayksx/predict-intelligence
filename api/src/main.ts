import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";
import { openDb } from "./db.js";
import perceiveRouter from "./routes/perceive.js";
import reasonRouter from "./routes/reason.js";
import actRouter from "./routes/act.js";
import profileRouter from "./routes/profile.js";
import ingestRouter from "./routes/ingest.js";

const app = express();
const port = parseInt(process.env.PORT ?? "4338");

const rawOrigins = process.env.CORS_ORIGINS ?? "http://localhost:3000";
const corsOrigin: cors.CorsOptions["origin"] =
  rawOrigins === "*" || rawOrigins === "true"
    ? true
    : rawOrigins.split(",").map(s => s.trim());

// Must run before anything else — sets ACAO unconditionally so Railway proxy cannot strip it
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/docs.json", (_req, res) => res.json(swaggerSpec));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/perceive", perceiveRouter);
app.use("/reason", reasonRouter);
app.use("/act", actRouter);
app.use("/profile", profileRouter);
app.use("/ingest", ingestRouter);

// Open (or create) the SQLite database before accepting requests
openDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`[api] server running at http://localhost:${port}`);
      console.log(`[api] Swagger UI  → http://localhost:${port}/docs`);
    });
  })
  .catch((err: unknown) => {
    console.error("[api] failed to open database:", err);
    process.exit(1);
  });
