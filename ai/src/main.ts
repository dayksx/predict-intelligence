import "dotenv/config";
import { runCli } from "./cli.js";

runCli().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
