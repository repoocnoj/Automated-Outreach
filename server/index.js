import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import multer from "multer";
import { generateAllDrafts, getDailyProgress } from "./draft-engine.js";
import { sendApprovedEmails, sendEmail } from "./gmail-client.js";
import { readLeads, addLeads, updateLeadStatus, writeLeads } from "./leads-store.js";
import { getVoiceConfig, saveVoiceConfig, getEmailExamples, saveEmailExamples } from "./voice-store.js";
import { generateSequences, getProgress } from "./sequence-engine.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const DRAFTS_PATH = "./data/drafts-latest.json";

app.use(cors());
app.use(express.json());

// File upload middleware
const upload = multer({ dest: "./data/uploads/" });

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
// DRAFT API ROUTES
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

// GET /api/progress — Daily draft generation progress
app.get("/api/progress", (req, res) => {
  res.json(getDailyProgress());
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
// LEADS API ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/leads — Return all leads with optional filters
app.get("/api/leads", (req, res) => {
  const leads = readLeads();
  const status = req.query.status;
  const filtered = status ? leads.filter((l) => l.status === status) : leads;
  res.json({
    leads: filtered,
    total: leads.length,
    counts: {
      not_contacted: leads.filter((l) => l.status === "not_contacted").length,
      drafted: leads.filter((l) => l.status === "drafted").length,
      approved: leads.filter((l) => l.status === "approved").length,
      sent: leads.filter((l) => l.status === "sent").length,
      replied: leads.filter((l) => l.status === "replied").length,
    },
  });
});

// POST /api/leads/upload — Upload CSV or XLSX file of leads
app.post("/api/leads/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    let leads = [];
    const ext = file.originalname.split(".").pop().toLowerCase();

    if (ext === "csv") {
      const csvContent = fs.readFileSync(file.path, "utf-8");
      const lines = csvContent.split("\n").filter((l) => l.trim());
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "").replace(/"/g, ""));

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = (values[idx] || "").replace(/^"|"$/g, "").trim();
        });
        if (obj.email || obj.name) leads.push(obj);
      }
    } else if (ext === "xlsx" || ext === "xls") {
      const XLSX = await import("xlsx");
      const workbook = XLSX.readFile(file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      leads = rows.map((row) => {
        const obj = {};
        Object.keys(row).forEach((key) => {
          obj[key.toLowerCase().replace(/\s+/g, "")] = String(row[key] || "");
        });
        return obj;
      });
    } else {
      return res.status(400).json({ error: "Unsupported file type. Use CSV or XLSX." });
    }

    fs.unlinkSync(file.path);

    const result = addLeads(leads, file.originalname);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/leads/:id — Update a lead
app.patch("/api/leads/:id", (req, res) => {
  const leads = readLeads();
  const idx = leads.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Lead not found" });

  const allowedFields = ["status", "notes", "painSignal", "sequenceStep"];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) leads[idx][field] = req.body[field];
  }
  writeLeads(leads);
  res.json({ lead: leads[idx] });
});

// DELETE /api/leads/:id — Remove a lead
app.delete("/api/leads/:id", (req, res) => {
  let leads = readLeads();
  leads = leads.filter((l) => l.id !== req.params.id);
  writeLeads(leads);
  res.json({ success: true });
});

// DELETE /api/leads — Clear all leads
app.delete("/api/leads", (req, res) => {
  writeLeads([]);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// VOICE & TEMPLATE API ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/voice — Get current voice config
app.get("/api/voice", (req, res) => {
  res.json({
    config: getVoiceConfig(),
    examples: getEmailExamples(),
  });
});

// PUT /api/voice — Update voice config
app.put("/api/voice", (req, res) => {
  saveVoiceConfig(req.body);
  res.json({ success: true });
});

// POST /api/voice/examples/upload — Upload example emails (CSV or XLSX)
app.post("/api/voice/examples/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    let examples = [];
    const ext = file.originalname.split(".").pop().toLowerCase();

    if (ext === "csv") {
      const content = fs.readFileSync(file.path, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = (values[idx] || "").replace(/^"|"$/g, "").trim();
        });
        examples.push(obj);
      }
    } else if (ext === "xlsx" || ext === "xls") {
      const XLSX = await import("xlsx");
      const workbook = XLSX.readFile(file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      examples = XLSX.utils.sheet_to_json(sheet);
    }

    fs.unlinkSync(file.path);

    const existing = getEmailExamples();
    const merged = [...existing, ...examples.map((ex) => ({
      id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      subject: ex.subject || ex.Subject || "",
      body: ex.body || ex.Body || ex.content || ex.Content || ex.message || ex.Message || "",
      recipient: ex.recipient || ex.Recipient || ex.to || ex.To || "",
      category: ex.category || ex.Category || ex.type || ex.Type || "general",
      performance: ex.performance || ex.Performance || ex.result || ex.Result || "",
      addedAt: new Date().toISOString(),
    }))];

    saveEmailExamples(merged);
    res.json({ added: examples.length, total: merged.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/voice/examples — Add a single example manually
app.post("/api/voice/examples", (req, res) => {
  const examples = getEmailExamples();
  examples.push({
    id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...req.body,
    addedAt: new Date().toISOString(),
  });
  saveEmailExamples(examples);
  res.json({ total: examples.length });
});

// DELETE /api/voice/examples/:id — Remove an example
app.delete("/api/voice/examples/:id", (req, res) => {
  let examples = getEmailExamples();
  examples = examples.filter((e) => e.id !== req.params.id);
  saveEmailExamples(examples);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// SEQUENCE API ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/sequences/generate — Generate sequences for selected leads
app.post("/api/sequences/generate", async (req, res) => {
  const { leadIds, sequenceConfig, sequenceContext } = req.body;

  if (!leadIds || leadIds.length === 0) {
    return res.status(400).json({ error: "No leads selected" });
  }

  const allLeads = readLeads();
  const selectedLeads = allLeads.filter((l) => leadIds.includes(l.id));

  if (selectedLeads.length === 0) {
    return res.status(404).json({ error: "No matching leads found" });
  }

  res.json({
    message: `Sequence generation started for ${selectedLeads.length} leads`,
    totalDrafts: selectedLeads.length * (
      (sequenceConfig.emails || 3) +
      (sequenceConfig.linkedinMessages || 0) +
      (sequenceConfig.textMessages || 0)
    ),
  });

  try {
    const drafts = await generateSequences(selectedLeads, sequenceConfig, sequenceContext);

    const existingDrafts = fs.existsSync("./data/drafts-latest.json")
      ? JSON.parse(fs.readFileSync("./data/drafts-latest.json", "utf-8"))
      : [];
    const merged = [...existingDrafts, ...drafts];
    fs.writeFileSync("./data/drafts-latest.json", JSON.stringify(merged, null, 2));
  } catch (err) {
    console.error("Sequence generation failed:", err);
  }
});

// GET /api/sequences/progress — Get current generation progress
app.get("/api/sequences/progress", (req, res) => {
  res.json(getProgress());
});

// ═══════════════════════════════════════════════════════════════
// CSV EXPORT FOR INSTANTLY
// ═══════════════════════════════════════════════════════════════

// GET /api/export/csv — Export drafts as CSV for Instantly
app.get("/api/export/csv", (req, res) => {
  const drafts = readDrafts();
  const status = req.query.status;
  const filtered = status
    ? drafts.filter((d) => d.status === status)
    : drafts.filter((d) => d.status !== "deleted");

  const headers = [
    "email",
    "first_name",
    "last_name",
    "company",
    "title",
    "subject",
    "body",
    "sequence_step",
    "total_steps",
    "modality",
    "day",
    "status",
    "category",
  ];

  const rows = filtered.map((d) => {
    const names = (d.recipient || "").split(" ");
    const firstName = names[0] || "";
    const lastName = names.slice(1).join(" ") || "";
    const titleCompany = (d.recipientTitle || "").split(",");

    return [
      d.recipientEmail || "",
      firstName,
      lastName,
      (titleCompany[1] || d.meta?.company || "").trim(),
      (titleCompany[0] || "").trim(),
      (d.subject || "").replace(/"/g, '""'),
      (d.body || "").replace(/"/g, '""').replace(/\n/g, "\\n"),
      d.sequenceStep || 1,
      d.totalSteps || 1,
      d.type || d.modality || "email",
      d.day || 0,
      d.status || "pending",
      d.category || "",
    ];
  });

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="outreach-export-${new Date().toISOString().split("T")[0]}.csv"`
  );
  res.send(csv);
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
