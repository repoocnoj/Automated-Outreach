import { generateAllDrafts } from "../server/draft-engine.js";

generateAllDrafts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
