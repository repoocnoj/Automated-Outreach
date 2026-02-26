import pool from "./db.js";

export async function readLeads(filters = {}) {
  let query = "SELECT * FROM leads";
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
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`(name ILIKE $${params.length} OR company ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY imported_at DESC";

  const result = await pool.query(query, params);
  return result.rows;
}

export async function addLeads(newLeads, source) {
  let added = 0;
  let duplicates = 0;

  for (const l of newLeads) {
    const email = (l.email || "").toLowerCase().trim();
    if (!email) continue;

    try {
      await pool.query(
        `INSERT INTO leads (id, name, email, title, company, company_size, industry, linkedin_url, pain_signal, notes, status, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'not_contacted', $11)
         ON CONFLICT (email) DO NOTHING`,
        [
          `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          l.name || "",
          email,
          l.title || l.jobTitle || l.jobtitle || "",
          l.company || l.companyName || "",
          l.companySize || l.employees || l.size || "",
          l.industry || l.sector || "",
          l.linkedinUrl || l.linkedin || "",
          l.painSignal || l.signal || l.reason || "",
          l.notes || "",
          source || "manual",
        ]
      );
      added++;
    } catch (err) {
      if (err.code === "23505") {
        duplicates++;
      } else {
        throw err;
      }
    }
  }

  const totalResult = await pool.query("SELECT COUNT(*) FROM leads");
  const total = parseInt(totalResult.rows[0].count);

  return { added, duplicates, total };
}

export async function updateLeadStatus(id, status) {
  const updates = { status };
  if (status === "drafted") updates.last_drafted_at = new Date().toISOString();
  if (status === "sent") updates.last_sent_at = new Date().toISOString();

  await pool.query(
    "UPDATE leads SET status = $1, last_drafted_at = COALESCE($2, last_drafted_at), last_sent_at = COALESCE($3, last_sent_at) WHERE id = $4",
    [status, updates.last_drafted_at || null, updates.last_sent_at || null, id]
  );
}

export async function updateLeadSequenceStep(id, step) {
  await pool.query("UPDATE leads SET sequence_step = $1 WHERE id = $2", [step, id]);
}

export async function assignLeads(leadIds, userId) {
  await pool.query(
    "UPDATE leads SET assigned_to = $1 WHERE id = ANY($2::varchar[])",
    [userId, leadIds]
  );
}

export async function getLeadCounts() {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'not_contacted') as not_contacted,
      COUNT(*) FILTER (WHERE status = 'drafted') as drafted,
      COUNT(*) FILTER (WHERE status = 'approved') as approved,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'replied') as replied
    FROM leads
  `);
  return result.rows[0];
}
