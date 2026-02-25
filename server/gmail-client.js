import { google } from "googleapis";
import fs from "fs";
import dotenv from "dotenv";
import { updateLeadStatus } from "./leads-store.js";

dotenv.config();

// ═══════════════════════════════════════════════════════════════
// GMAIL CLIENT
// ═══════════════════════════════════════════════════════════════

async function getGmailClient() {
  const credPath = process.env.GMAIL_CREDENTIALS_PATH || "./gmail-credentials.json";
  const tokenPath = process.env.GMAIL_TOKEN_PATH || "./gmail-token.json";

  if (!fs.existsSync(credPath)) {
    throw new Error(
      `Gmail credentials not found. Run: npm run auth-gmail\n` +
        `Expected at: ${credPath}`
    );
  }
  if (!fs.existsSync(tokenPath)) {
    throw new Error(
      `Gmail not authorized yet. Run: npm run auth-gmail\n` +
        `Expected at: ${tokenPath}`
    );
  }

  const credentials = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  const { client_id, client_secret, redirect_uris } =
    credentials.installed || credentials.web;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris ? redirect_uris[0] : "http://localhost"
  );

  const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
  oAuth2Client.setCredentials(tokens);

  // Auto-refresh token if expired
  oAuth2Client.on("tokens", (newTokens) => {
    const updated = { ...tokens, ...newTokens };
    fs.writeFileSync(tokenPath, JSON.stringify(updated, null, 2));
  });

  return google.gmail({ version: "v1", auth: oAuth2Client });
}

function buildRawEmail(to, subject, body, from = "me") {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ═══════════════════════════════════════════════════════════════
// SEND A SINGLE EMAIL
// ═══════════════════════════════════════════════════════════════

export async function sendEmail(to, subject, body) {
  const gmail = await getGmailClient();
  const raw = buildRawEmail(to, subject, body);

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return result.data;
}

// ═══════════════════════════════════════════════════════════════
// SEND ALL APPROVED EMAILS FROM LATEST DRAFTS
// ═══════════════════════════════════════════════════════════════

export async function sendApprovedEmails() {
  const draftsPath = "./data/drafts-latest.json";

  if (!fs.existsSync(draftsPath)) {
    console.log("No drafts file found.");
    return { sent: 0, failed: 0, results: [] };
  }

  const drafts = JSON.parse(fs.readFileSync(draftsPath, "utf-8"));
  const approved = drafts.filter(
    (d) =>
      d.type === "email" &&
      (d.status === "approved" || d.status === "edited") &&
      d.recipientEmail
  );

  if (approved.length === 0) {
    console.log("No approved emails to send.");
    return { sent: 0, failed: 0, results: [] };
  }

  console.log(`\n📤 Sending ${approved.length} approved emails...`);
  let sent = 0;
  let failed = 0;
  const results = [];

  for (const draft of approved) {
    try {
      await sendEmail(draft.recipientEmail, draft.subject, draft.body);
      draft.status = "sent";
      draft.sentAt = new Date().toISOString();
      sent++;
      results.push({ id: draft.id, recipient: draft.recipient, status: "sent" });
      console.log(`   ✓ ${draft.recipient} (${draft.recipientEmail})`);

      // Update lead status if this draft is linked to a lead
      if (draft.leadId) {
        try {
          updateLeadStatus(draft.leadId, "sent");
        } catch (e) {
          // Non-fatal
        }
      }

      // Gmail rate limit: max 1 email per 2 seconds
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      failed++;
      results.push({
        id: draft.id,
        recipient: draft.recipient,
        status: "failed",
        error: err.message,
      });
      console.error(`   ✗ ${draft.recipient}: ${err.message}`);
    }
  }

  // Save updated statuses
  fs.writeFileSync(draftsPath, JSON.stringify(drafts, null, 2));
  console.log(`\n✅ ${sent} sent, ${failed} failed.\n`);

  return { sent, failed, results };
}
