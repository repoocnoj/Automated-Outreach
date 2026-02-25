import cron from "node-cron";
import { generateAllDrafts } from "./draft-engine.js";

// ═══════════════════════════════════════════════════════════════
// DAILY SCHEDULER
// ═══════════════════════════════════════════════════════════════
// Runs at 7:30 AM ET Monday–Friday
// To enable: import this file in server/index.js

// Convert ET to server time if needed
// This assumes server runs in ET or you adjust the cron string
cron.schedule(
  "30 7 * * 1-5",
  async () => {
    console.log("\n⏰ Scheduled daily draft generation triggered...");
    try {
      await generateAllDrafts();
    } catch (err) {
      console.error("Scheduled generation failed:", err);
    }
  },
  {
    timezone: "America/New_York",
  }
);

console.log("📅 Daily scheduler active: 7:30 AM ET, Monday–Friday");
