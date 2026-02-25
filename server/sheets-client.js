import { google } from "googleapis";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// ═══════════════════════════════════════════════════════════════
// GOOGLE SHEETS CLIENT
// ═══════════════════════════════════════════════════════════════

let sheetsClient = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const credPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  if (!credPath || !fs.existsSync(credPath)) {
    throw new Error(
      `Google service account file not found at: ${credPath}\n` +
        "See POST-BUILD SETUP section for instructions."
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

// ═══════════════════════════════════════════════════════════════
// READ PROSPECTS
// ═══════════════════════════════════════════════════════════════
// Expected columns in Google Sheet (Row 1 = headers):
//   A: name
//   B: email
//   C: title
//   D: company
//   E: companySize
//   F: industry
//   G: linkedinUrl
//   H: painSignal
//   I: status          (queued | drafted | sent | replied | skip)
//   J: lastContacted   (date string)
//   K: notes
// ═══════════════════════════════════════════════════════════════

export async function getQueuedProspects(limit = 20) {
  const sheets = await getSheetsClient();
  const sheetId = process.env.PROSPECTS_SHEET_ID;

  if (!sheetId) throw new Error("PROSPECTS_SHEET_ID not set in .env");

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Sheet1!A:K",
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const prospects = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] || "";
    });

    // Map common header variations
    const prospect = {
      name: obj.name || obj.fullname || "",
      email: obj.email || obj.workemail || "",
      title: obj.title || obj.jobtitle || "",
      company: obj.company || obj.companyname || "",
      companySize: obj.companysize || obj.employees || obj.size || "",
      industry: obj.industry || obj.sector || "",
      linkedinUrl: obj.linkedinurl || obj.linkedin || "",
      painSignal: obj.painsignal || obj.signal || obj.reason || "",
      status: (obj.status || "queued").toLowerCase().trim(),
      lastContacted: obj.lastcontacted || obj.lastcontact || "",
      notes: obj.notes || "",
      rowIndex: i + 1, // 1-indexed for Sheets API
    };

    if (prospect.status === "queued" && prospect.name && prospect.email) {
      prospects.push(prospect);
    }
  }

  return prospects.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════
// READ CONTACTS (Stay-in-Touch)
// ═══════════════════════════════════════════════════════════════
// Expected columns:
//   A: name
//   B: email
//   C: relationship
//   D: company
//   E: title
//   F: lastContactDate  (date string, e.g., "2025-10-15")
//   G: sharedContext
//   H: frequency        (weekly | biweekly | monthly | quarterly)
//   I: notes
// ═══════════════════════════════════════════════════════════════

export async function getContactsDueForOutreach(limit = 5) {
  const sheets = await getSheetsClient();
  const sheetId = process.env.CONTACTS_SHEET_ID;

  if (!sheetId) throw new Error("CONTACTS_SHEET_ID not set in .env");

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Sheet1!A:I",
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const contacts = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] || "";
    });

    const contact = {
      name: obj.name || "",
      email: obj.email || "",
      relationship: obj.relationship || "",
      company: obj.company || "",
      title: obj.title || "",
      lastContactDate: obj.lastcontactdate || obj.lastcontact || "",
      sharedContext: obj.sharedcontext || obj.context || "",
      frequency: (obj.frequency || "monthly").toLowerCase().trim(),
      notes: obj.notes || "",
      rowIndex: i + 1,
    };

    if (contact.name && contact.email) {
      contacts.push(contact);
    }
  }

  // Sort by least-recently-contacted first
  contacts.sort((a, b) => {
    const dateA = a.lastContactDate ? new Date(a.lastContactDate) : new Date(0);
    const dateB = b.lastContactDate ? new Date(b.lastContactDate) : new Date(0);
    return dateA - dateB;
  });

  return contacts.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════
// UPDATE STATUS (mark prospect as "drafted" after generating)
// ═══════════════════════════════════════════════════════════════

export async function updateProspectStatus(rowIndex, status) {
  const sheets = await getSheetsClient();
  const sheetId = process.env.PROSPECTS_SHEET_ID;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Sheet1!I${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [[status]] },
  });
}

export async function updateContactLastContacted(rowIndex, date) {
  const sheets = await getSheetsClient();
  const sheetId = process.env.CONTACTS_SHEET_ID;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Sheet1!F${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [[date]] },
  });
}

// ═══════════════════════════════════════════════════════════════
// READ LINKEDIN POSTS (from local JSON — populated by Phantombuster)
// ═══════════════════════════════════════════════════════════════

export function getLinkedInPosts(limit = 5) {
  const postsPath = "./data/linkedin-posts.json";

  if (!fs.existsSync(postsPath)) {
    console.warn("No linkedin-posts.json found. Skipping LinkedIn drafts.");
    return [];
  }

  const posts = JSON.parse(fs.readFileSync(postsPath, "utf-8"));
  return posts.slice(0, limit);
}
