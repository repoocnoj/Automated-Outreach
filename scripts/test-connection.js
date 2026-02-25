import dotenv from "dotenv";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";

dotenv.config();

async function testAll() {
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  CONNECTION TEST");
  console.log("═══════════════════════════════════════════════════\n");

  let allPassed = true;

  // 1. Test Anthropic API
  console.log("1. Anthropic API...");
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      messages: [{ role: "user", content: "Say 'connection successful' and nothing else." }],
    });
    const text = res.content[0]?.text || "";
    console.log(`   ✅ Anthropic API works. Response: "${text.trim()}"\n`);
  } catch (err) {
    console.log(`   ❌ Anthropic API failed: ${err.message}\n`);
    allPassed = false;
  }

  // 2. Test Google Sheets
  console.log("2. Google Sheets API...");
  try {
    const credPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
    if (!credPath || !fs.existsSync(credPath)) throw new Error("Service account file not found");
    const auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.PROSPECTS_SHEET_ID;
    if (!sheetId) throw new Error("PROSPECTS_SHEET_ID not set");
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Sheet1!A1:A2",
    });
    console.log(`   ✅ Google Sheets works. Found ${res.data.values?.length || 0} rows.\n`);
  } catch (err) {
    console.log(`   ❌ Google Sheets failed: ${err.message}\n`);
    allPassed = false;
  }

  // 3. Test Gmail
  console.log("3. Gmail API...");
  try {
    const tokenPath = process.env.GMAIL_TOKEN_PATH || "./gmail-token.json";
    if (!fs.existsSync(tokenPath)) throw new Error("Gmail not authorized. Run: npm run auth-gmail");
    console.log(`   ✅ Gmail token exists at ${tokenPath}\n`);
  } catch (err) {
    console.log(`   ❌ Gmail: ${err.message}\n`);
    allPassed = false;
  }

  // 4. Test LinkedIn data
  console.log("4. LinkedIn posts data...");
  if (fs.existsSync("./data/linkedin-posts.json")) {
    const posts = JSON.parse(fs.readFileSync("./data/linkedin-posts.json", "utf-8"));
    console.log(`   ✅ Found ${posts.length} LinkedIn posts.\n`);
  } else {
    console.log("   ⚠️  No linkedin-posts.json found (optional).\n");
  }

  // 5. Test Apify
  console.log("5. Apify API...");
  try {
    if (!process.env.APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not set");
    const { ApifyClient } = await import("apify-client");
    const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
    const user = await client.user().get();
    console.log(`   ✅ Apify connected. Account: ${user.username}\n`);
  } catch (err) {
    console.log(`   ❌ Apify: ${err.message}\n`);
    allPassed = false;
  }

  console.log("═══════════════════════════════════════════════════");
  if (allPassed) {
    console.log("  ✅ ALL CONNECTIONS PASSED");
  } else {
    console.log("  ⚠️  SOME CONNECTIONS FAILED — see above");
  }
  console.log("═══════════════════════════════════════════════════\n");
}

testAll().catch(console.error);
