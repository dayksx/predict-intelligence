import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";
import perceiveRouter from "./routes/perceive.js";
import reasonRouter from "./routes/reason.js";
import actRouter from "./routes/act.js";
import profileRouter from "./routes/profile.js";
import ingestRouter from "./routes/ingest.js";

const app = express();
const port = parseInt(process.env.PORT ?? "4338");

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",");
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "5mb" }));

// Swagger UI at /docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/docs.json", (_req, res) => res.json(swaggerSpec));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Read endpoints (UI → api)
app.use("/perceive", perceiveRouter);
app.use("/reason", reasonRouter);
app.use("/act", actRouter);
app.use("/profile", profileRouter);

// Write endpoints (listener + ai → api)
app.use("/ingest", ingestRouter);

app.listen(port, () => {
  console.log(`[api] server running at http://localhost:${port}`);
  console.log(`[api] Swagger UI  → http://localhost:${port}/docs`);
  console.log(`[api] GET  /perceive`);
  console.log(`[api] GET  /reason/:label  |  /act/:label  |  /profile/:label`);
  console.log(`[api] POST /ingest/markets  |  /ingest/profiles  |  /ingest/audit  |  /ingest/positions`);
});
