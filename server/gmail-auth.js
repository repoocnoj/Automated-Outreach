import { google } from "googleapis";
import fs from "fs";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config();

const credPath = process.env.GMAIL_CREDENTIALS_PATH || "./gmail-credentials.json";

if (!fs.existsSync(credPath)) {
  console.error(`\n❌ Gmail credentials not found at: ${credPath}`);
  console.error("   Download OAuth credentials from Google Cloud Console.");
  console.error("   See POST-BUILD SETUP section in the build spec.\n");
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credPath, "utf-8"));
const { client_id, client_secret, redirect_uris } =
  credentials.installed || credentials.web;

const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris ? redirect_uris[0] : "http://localhost"
);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
});

console.log("\n═══════════════════════════════════════════════════");
console.log("  GMAIL AUTHORIZATION");
console.log("═══════════════════════════════════════════════════");
console.log("\n1. Open this URL in your browser:\n");
console.log(`   ${authUrl}\n`);
console.log("2. Sign in with your Gmail account");
console.log("3. Click 'Allow'");
console.log("4. Copy the authorization code and paste it below\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Paste authorization code here: ", async (code) => {
  try {
    const { tokens } = await oAuth2Client.getToken(code.trim());
    const tokenPath = process.env.GMAIL_TOKEN_PATH || "./gmail-token.json";
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
    console.log(`\n✅ Gmail token saved to ${tokenPath}`);
    console.log("   You can now send emails via the dashboard.\n");
  } catch (err) {
    console.error(`\n❌ Error getting token: ${err.message}\n`);
  }
  rl.close();
});
