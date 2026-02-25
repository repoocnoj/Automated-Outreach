import fs from "fs";

const LEADS_PATH = "./data/leads.json";

// Lead object shape:
// {
//   id: string,
//   name: string,
//   email: string,
//   title: string,
//   company: string,
//   companySize: string,
//   industry: string,
//   linkedinUrl: string,
//   painSignal: string,
//   notes: string,
//   status: "not_contacted" | "drafted" | "approved" | "sent" | "replied",
//   importedAt: ISO date string,
//   lastDraftedAt: ISO date string or null,
//   lastSentAt: ISO date string or null,
//   sequenceStep: number (0 = not started),
//   source: string (filename of the CSV/XLSX they came from)
// }

export function readLeads() {
  if (!fs.existsSync(LEADS_PATH)) return [];
  return JSON.parse(fs.readFileSync(LEADS_PATH, "utf-8"));
}

export function writeLeads(leads) {
  if (!fs.existsSync("./data")) fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(LEADS_PATH, JSON.stringify(leads, null, 2));
}

export function addLeads(newLeads, source) {
  const existing = readLeads();
  const existingEmails = new Set(existing.map((l) => l.email.toLowerCase()));

  const toAdd = newLeads
    .filter((l) => l.email && !existingEmails.has(l.email.toLowerCase()))
    .map((l) => ({
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: l.name || "",
      email: l.email || "",
      title: l.title || l.jobTitle || l.jobtitle || "",
      company: l.company || l.companyName || "",
      companySize: l.companySize || l.employees || l.size || "",
      industry: l.industry || l.sector || "",
      linkedinUrl: l.linkedinUrl || l.linkedin || "",
      painSignal: l.painSignal || l.signal || l.reason || "",
      notes: l.notes || "",
      status: "not_contacted",
      importedAt: new Date().toISOString(),
      lastDraftedAt: null,
      lastSentAt: null,
      sequenceStep: 0,
      source: source || "manual",
    }));

  const merged = [...existing, ...toAdd];
  writeLeads(merged);
  return { added: toAdd.length, duplicates: newLeads.length - toAdd.length, total: merged.length };
}

export function updateLeadStatus(id, status) {
  const leads = readLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  leads[idx].status = status;
  if (status === "drafted") leads[idx].lastDraftedAt = new Date().toISOString();
  if (status === "sent") leads[idx].lastSentAt = new Date().toISOString();
  writeLeads(leads);
  return leads[idx];
}

export function updateLeadSequenceStep(id, step) {
  const leads = readLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  leads[idx].sequenceStep = step;
  writeLeads(leads);
  return leads[idx];
}
