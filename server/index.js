import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateAllDrafts } from "./draft-engine.js";
import { sendApprovedEmails, sendEmail } from "./gmail-client.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const DRAFTS_PATH = "./data/drafts-latest.json";

app.use(cors());
app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync("./data")) {
  fs.mkdirSync("./data", { recursive: true });
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Read/write drafts
// ═══════════════════════════════════════════════════════════════

function readDrafts() {
  if (!fs.existsSync(DRAFTS_PATH)) return [];
  return JSON.parse(fs.readFileSync(DRAFTS_PATH, "utf-8"));
}

function writeDrafts(drafts) {
  fs.writeFileSync(DRAFTS_PATH, JSON.stringify(drafts, null, 2));
}

// ═══════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/drafts — Return all drafts
app.get("/api/drafts", (req, res) => {
  const drafts = readDrafts();
  res.json({ drafts, count: drafts.length });
});

// PATCH /api/drafts/:id — Update a draft (status, body, subject)
app.patch("/api/drafts/:id", (req, res) => {
  const drafts = readDrafts();
  const idx = drafts.findIndex((d) => d.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ error: "Draft not found" });
  }

  const allowedFields = ["status", "body", "subject"];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      drafts[idx][field] = req.body[field];
    }
  }

  drafts[idx].updatedAt = new Date().toISOString();
  writeDrafts(drafts);
  res.json({ draft: drafts[idx] });
});

// POST /api/drafts/:id/approve — Approve a single draft
app.post("/api/drafts/:id/approve", (req, res) => {
  const drafts = readDrafts();
  const idx = drafts.findIndex((d) => d.id === req.params.id);

  if (idx === -1) return res.status(404).json({ error: "Draft not found" });

  drafts[idx].status = "approved";
  drafts[idx].updatedAt = new Date().toISOString();
  writeDrafts(drafts);
  res.json({ draft: drafts[idx] });
});

// POST /api/drafts/:id/delete — Soft-delete a draft
app.post("/api/drafts/:id/delete", (req, res) => {
  const drafts = readDrafts();
  const idx = drafts.findIndex((d) => d.id === req.params.id);

  if (idx === -1) return res.status(404).json({ error: "Draft not found" });

  drafts[idx].status = "deleted";
  drafts[idx].updatedAt = new Date().toISOString();
  writeDrafts(drafts);
  res.json({ draft: drafts[idx] });
});

// POST /api/drafts/:id/restore — Restore a deleted draft
app.post("/api/drafts/:id/restore", (req, res) => {
  const drafts = readDrafts();
  const idx = drafts.findIndex((d) => d.id === req.params.id);

  if (idx === -1) return res.status(404).json({ error: "Draft not found" });

  drafts[idx].status = "pending";
  drafts[idx].updatedAt = new Date().toISOString();
  writeDrafts(drafts);
  res.json({ draft: drafts[idx] });
});

// POST /api/approve-all — Approve all pending drafts
app.post("/api/approve-all", (req, res) => {
  const drafts = readDrafts();
  let count = 0;

  drafts.forEach((d) => {
    if (d.status === "pending") {
      d.status = "approved";
      d.updatedAt = new Date().toISOString();
      count++;
    }
  });

  writeDrafts(drafts);
  res.json({ approved: count });
});

// POST /api/send-all — Send all approved emails via Gmail
app.post("/api/send-all", async (req, res) => {
  try {
    const result = await sendApprovedEmails();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/send/:id — Send a single approved email
app.post("/api/send/:id", async (req, res) => {
  const drafts = readDrafts();
  const draft = drafts.find((d) => d.id === req.params.id);

  if (!draft) return res.status(404).json({ error: "Draft not found" });
  if (draft.type !== "email")
    return res.status(400).json({ error: "Can only send emails" });
  if (!draft.recipientEmail)
    return res.status(400).json({ error: "No recipient email" });
  if (draft.status !== "approved" && draft.status !== "edited")
    return res.status(400).json({ error: "Draft must be approved first" });

  try {
    await sendEmail(draft.recipientEmail, draft.subject, draft.body);
    draft.status = "sent";
    draft.sentAt = new Date().toISOString();
    writeDrafts(drafts);
    res.json({ draft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate — Trigger draft generation manually
app.post("/api/generate", async (req, res) => {
  try {
    res.json({ message: "Draft generation started. This takes 3-5 minutes." });
    // Run in background
    generateAllDrafts().catch((err) =>
      console.error("Draft generation failed:", err)
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/health — Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasDrafts: fs.existsSync(DRAFTS_PATH),
    draftCount: readDrafts().length,
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// SERVE STATIC FRONTEND (in production)
// ═══════════════════════════════════════════════════════════════

if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(process.cwd(), "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`\n🚀 Overalls Outreach API running on http://localhost:${PORT}`);
  console.log(`   Dashboard: http://localhost:3000`);
  console.log(`   Health:    http://localhost:${PORT}/api/health\n`);
});
