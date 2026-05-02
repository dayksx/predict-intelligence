import "dotenv/config";
import { buildContainer } from "./infrastructure/container.js";

const port = parseInt(process.env.PORT ?? "4337");
const { app, runDailyCycle } = buildContainer();

app.listen(port, () => {
  console.log(`[a2a] server running at http://localhost:${port}`);
  console.log(`[a2a] agent card: http://localhost:${port}/.well-known/agent-card.json`);
  console.log(`[a2a] send message: POST http://localhost:${port}/message:send`);
  console.log(`[a2a] poll task:    GET  http://localhost:${port}/tasks/:id`);
});

// Run the daily analysis-investment cycle immediately on startup, then every 24h.
// Each registered ENS user is processed independently with their own strategy.
const CYCLE_INTERVAL_MS = parseInt(process.env.CYCLE_INTERVAL_MS ?? String(24 * 60 * 60 * 1000));

(async () => {
  await runDailyCycle();

  setInterval(async () => {
    try {
      await runDailyCycle();
    } catch (err) {
      console.error("[scheduler] daily cycle error:", err);
    }
  }, CYCLE_INTERVAL_MS);
})().catch((err) => {
  console.error("[scheduler] startup error:", err);
  process.exit(1);
});
