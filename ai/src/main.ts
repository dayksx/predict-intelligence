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

// Schedule the daily cycle — runs on interval only, NOT on startup.
// Trigger manually via A2A or wait for the first interval.
const CYCLE_INTERVAL_MS = parseInt(process.env.CYCLE_INTERVAL_MS ?? String(24 * 60 * 60 * 1000));

console.log(`[scheduler] daily cycle scheduled every ${Math.round(CYCLE_INTERVAL_MS / 60_000)} min (first run at T+${Math.round(CYCLE_INTERVAL_MS / 60_000)} min)`);

setInterval(async () => {
  try {
    await runDailyCycle();
  } catch (err) {
    console.error("[scheduler] daily cycle error:", err);
  }
}, CYCLE_INTERVAL_MS);
