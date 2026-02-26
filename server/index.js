import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import multer from "multer";
import pool from "./db.js";
import { initDatabase } from "./db.js";
import { generateAllDrafts, getDailyProgress } from "./draft-engine.js";
import { readLeads, addLeads, updateLeadStatus, assignLeads, getLeadCounts } from "./leads-store.js";
import { getVoiceConfig, saveVoiceConfig, getEmailExamples, saveEmailExample, deleteEmailExample } from "./voice-store.js";
import { generateSequences, getProgress } from "./sequence-engine.js";
import { loginUser, createUser, authMiddleware, adminMiddleware, getTeamMembers, seedAdminUser } from "./auth.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// File upload middleware
const upload = multer({ dest: "./data/uploads/" });

// Ensure data directory exists
if (!fs.existsSync("./data")) {
  fs.mkdirSync("./data", { recursive: true });
}

// Initialize database and seed admin on startup
await initDatabase();
await seedAdminUser();

// ═══════════════════════════════════════════════════════════════
// HELPER: Draft CRUD via PostgreSQL
// ═══════════════════════════════════════════════════════════════

async function readDrafts(filters = {}) {
  let query = "SELECT * FROM drafts";
  const conditions = [];
  const params = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filters.assignedTo) {
    params.push(filters.assignedTo);
    conditions.push(`assigned_to = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY created_at DESC";
  const result = await pool.query(query, params);
  return result.rows;
}

async function saveDraft(draft) {
  await pool.query(
    `INSERT INTO drafts (id, lead_id, type, category, recipient, recipient_title, recipient_email, subject, body, research_notes, status, sequence_step, total_steps, day, modality, scheduled_time, assigned_to, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (id) DO UPDATE SET
       subject = EXCLUDED.subject,
       body = EXCLUDED.body,
       status = EXCLUDED.status,
       updated_at = NOW()`,
    [
      draft.id,
      draft.leadId || null,
      draft.type,
      draft.category,
      draft.recipient,
      draft.recipientTitle || "",
      draft.recipientEmail || "",
      draft.subject || "",
      draft.body || "",
      draft.researchNotes || "",
      draft.status || "pending",
      draft.sequenceStep || null,
      draft.totalSteps || null,
      draft.day || null,
      draft.modality || draft.type,
      draft.scheduledTime || "",
      draft.assignedTo || null,
      JSON.stringify(draft.meta || {}),
    ]
  );
}

async function updateDraft(id, updates) {
  const fields = [];
  const params = [];
  let paramIndex = 1;

  const allowedFields = {
    status: "status",
    subject: "subject",
    body: "body",
    assigned_to: "assigned_to",
  };

  for (const [key, column] of Object.entries(allowedFields)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = $${paramIndex}`);
      params.push(updates[key]);
      paramIndex++;
    }
  }

  if (fields.length === 0) return;

  fields.push(`updated_at = NOW()`);
  params.push(id);

  await pool.query(
    `UPDATE drafts SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
    params
  );
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required)
// ═══════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// GET /api/health — Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// GET /api/sequences/progress — no auth required for polling simplicity
app.get("/api/sequences/progress", (req, res) => {
  res.json(getProgress());
});

// GET /api/progress — Daily draft generation progress
app.get("/api/progress", (req, res) => {
  res.json(getDailyProgress());
});

// ═══════════════════════════════════════════════════════════════
// PROTECTED ROUTES (auth required)
// ═══════════════════════════════════════════════════════════════

// GET /api/auth/me — Get current user
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/team — Get all team members
app.get("/api/team", authMiddleware, async (req, res) => {
  const members = await getTeamMembers();
  res.json({ members });
});

// POST /api/team/invite — Create a new team member (admin only)
app.post("/api/team/invite", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    const user = await createUser(email, name, password, role || "member");
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DRAFT API ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/drafts — Return all drafts
app.get("/api/drafts", authMiddleware, async (req, res) => {
  const filters = {
    status: req.query.status,
    assignedTo: req.query.assignedTo,
  };
  const drafts = await readDrafts(filters);
  res.json({ drafts, count: drafts.length });
});

// PATCH /api/drafts/:id — Update a draft (status, body, subject)
app.patch("/api/drafts/:id", authMiddleware, async (req, res) => {
  try {
    await updateDraft(req.params.id, req.body);
    const result = await pool.query("SELECT * FROM drafts WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Draft not found" });
    res.json({ draft: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/drafts/:id/approve — Approve a single draft
app.post("/api/drafts/:id/approve", authMiddleware, async (req, res) => {
  await pool.query("UPDATE drafts SET status = 'approved', updated_at = NOW() WHERE id = $1", [req.params.id]);
  const result = await pool.query("SELECT * FROM drafts WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Draft not found" });
  res.json({ draft: result.rows[0] });
});

// POST /api/drafts/:id/delete — Soft-delete a draft
app.post("/api/drafts/:id/delete", authMiddleware, async (req, res) => {
  await pool.query("UPDATE drafts SET status = 'deleted', updated_at = NOW() WHERE id = $1", [req.params.id]);
  const result = await pool.query("SELECT * FROM drafts WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Draft not found" });
  res.json({ draft: result.rows[0] });
});

// POST /api/drafts/:id/restore — Restore a deleted draft
app.post("/api/drafts/:id/restore", authMiddleware, async (req, res) => {
  await pool.query("UPDATE drafts SET status = 'pending', updated_at = NOW() WHERE id = $1", [req.params.id]);
  const result = await pool.query("SELECT * FROM drafts WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Draft not found" });
  res.json({ draft: result.rows[0] });
});

// POST /api/approve-all — Approve all pending drafts
app.post("/api/approve-all", authMiddleware, async (req, res) => {
  const result = await pool.query(
    "UPDATE drafts SET status = 'approved', updated_at = NOW() WHERE status = 'pending'"
  );
  res.json({ approved: result.rowCount });
});

// POST /api/generate — Trigger draft generation manually
app.post("/api/generate", authMiddleware, async (req, res) => {
  try {
    res.json({ message: "Draft generation started. This takes 3-5 minutes." });
    generateAllDrafts().catch((err) =>
      console.error("Draft generation failed:", err)
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// LEADS API ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/leads — Return all leads with optional filters
app.get("/api/leads", authMiddleware, async (req, res) => {
  const filters = {
    status: req.query.status,
    assignedTo: req.query.assignedTo,
    search: req.query.search,
  };
  const leads = await readLeads(filters);
  const counts = await getLeadCounts();
  res.json({ leads, counts });
});

// POST /api/leads/upload — Upload CSV or XLSX file of leads
app.post("/api/leads/upload", authMiddleware, upload.single("file"), async (req, res) => {
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

    const result = await addLeads(leads, file.originalname);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/assign — Assign leads to a team member
app.post("/api/leads/assign", authMiddleware, async (req, res) => {
  const { leadIds, userId } = req.body;
  if (!leadIds || !userId) return res.status(400).json({ error: "leadIds and userId required" });

  await assignLeads(leadIds, userId);
  res.json({ assigned: leadIds.length, userId });
});

// PATCH /api/leads/:id — Update a lead
app.patch("/api/leads/:id", authMiddleware, async (req, res) => {
  const allowedFields = ["status", "notes", "pain_signal", "sequence_step"];
  const fields = [];
  const params = [];
  let i = 1;

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      fields.push(`${field} = $${i}`);
      params.push(req.body[field]);
      i++;
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: "No valid fields to update" });

  params.push(req.params.id);
  await pool.query(`UPDATE leads SET ${fields.join(", ")} WHERE id = $${i}`, params);

  const result = await pool.query("SELECT * FROM leads WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Lead not found" });
  res.json({ lead: result.rows[0] });
});

// DELETE /api/leads/:id — Remove a lead
app.delete("/api/leads/:id", authMiddleware, async (req, res) => {
  await pool.query("DELETE FROM leads WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

// DELETE /api/leads — Clear all leads
app.delete("/api/leads", authMiddleware, async (req, res) => {
  await pool.query("DELETE FROM leads");
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// VOICE & TEMPLATE API ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/voice — Get current voice config
app.get("/api/voice", authMiddleware, async (req, res) => {
  const config = await getVoiceConfig();
  const examples = await getEmailExamples();
  res.json({ config, examples });
});

// PUT /api/voice — Update voice config
app.put("/api/voice", authMiddleware, async (req, res) => {
  await saveVoiceConfig(req.body);
  res.json({ success: true });
});

// POST /api/voice/examples/upload — Upload example emails (CSV or XLSX)
app.post("/api/voice/examples/upload", authMiddleware, upload.single("file"), async (req, res) => {
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

    let addedCount = 0;
    for (const ex of examples) {
      await saveEmailExample({
        id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        subject: ex.subject || ex.Subject || "",
        body: ex.body || ex.Body || ex.content || ex.Content || ex.message || ex.Message || "",
        recipient: ex.recipient || ex.Recipient || ex.to || ex.To || "",
        category: ex.category || ex.Category || ex.type || ex.Type || "general",
        performance: ex.performance || ex.Performance || ex.result || ex.Result || "",
      });
      addedCount++;
    }

    const allExamples = await getEmailExamples();
    res.json({ added: addedCount, total: allExamples.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/voice/examples — Add a single example manually
app.post("/api/voice/examples", authMiddleware, async (req, res) => {
  await saveEmailExample({
    id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...req.body,
  });
  const examples = await getEmailExamples();
  res.json({ total: examples.length });
});

// DELETE /api/voice/examples/:id — Remove an example
app.delete("/api/voice/examples/:id", authMiddleware, async (req, res) => {
  await deleteEmailExample(req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// SEQUENCE API ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/sequences/generate — Generate sequences for selected leads
app.post("/api/sequences/generate", authMiddleware, async (req, res) => {
  const { leadIds, sequenceConfig, sequenceContext } = req.body;

  if (!leadIds || leadIds.length === 0) {
    return res.status(400).json({ error: "No leads selected" });
  }

  const allLeads = await readLeads();
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

    // Save each draft to PostgreSQL
    for (const draft of drafts) {
      await saveDraft(draft);
    }
  } catch (err) {
    console.error("Sequence generation failed:", err);
  }
});

// ═══════════════════════════════════════════════════════════════
// CSV EXPORT FOR INSTANTLY
// ═══════════════════════════════════════════════════════════════

// GET /api/export/csv — Export drafts as CSV for Instantly
app.get("/api/export/csv", authMiddleware, async (req, res) => {
  const drafts = await readDrafts();
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
    const titleCompany = (d.recipient_title || "").split(",");

    return [
      d.recipient_email || "",
      firstName,
      lastName,
      (titleCompany[1] || "").trim(),
      (titleCompany[0] || "").trim(),
      (d.subject || "").replace(/"/g, '""'),
      (d.body || "").replace(/"/g, '""').replace(/\n/g, "\\n"),
      d.sequence_step || 1,
      d.total_steps || 1,
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
  const clientDist = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDist));

  // SPA fallback — serve index.html for all non-API routes
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(clientDist, "index.html"));
    }
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
