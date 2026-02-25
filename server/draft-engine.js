import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import fs from "fs";
import {
  VOICE_PROFILE,
  PROSPECT_PROMPT,
  STAY_IN_TOUCH_PROMPT,
  LINKEDIN_COMMENT_PROMPT,
} from "./voice-profile.js";
import {
  getQueuedProspects,
  getContactsDueForOutreach,
  getLinkedInPosts,
  updateProspectStatus,
} from "./sheets-client.js";
import { fetchLinkedInPosts } from "./apify-linkedin.js";
import { getVoiceConfig, getEmailExamples } from "./voice-store.js";
import { updateLeadStatus, updateLeadSequenceStep } from "./leads-store.js";

dotenv.config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-20250514";

// ═══════════════════════════════════════════════════════════════
// DAILY PROGRESS TRACKING
// ═══════════════════════════════════════════════════════════════

let dailyProgress = {
  active: false,
  current: "",
  completed: 0,
  total: 0,
  percent: 0,
};

export function getDailyProgress() {
  return { ...dailyProgress };
}

// ═══════════════════════════════════════════════════════════════
// CORE DRAFTING FUNCTION
// ═══════════════════════════════════════════════════════════════

async function buildSystemPrompt() {
  const config = getVoiceConfig();
  const examples = getEmailExamples();

  let prompt = VOICE_PROFILE;

  // Add custom instructions if enabled
  if (config.useCustom && config.customInstructions) {
    prompt += `\n\n## ADDITIONAL INSTRUCTIONS FROM USER\n${config.customInstructions}\n`;
  }

  // Add email examples as few-shot references
  if (examples.length > 0) {
    prompt += `\n\n## EXAMPLE EMAILS THAT HAVE PERFORMED WELL\nUse these as style references. Match their tone, structure, and approach:\n\n`;
    // Include up to 10 best examples to avoid token limits
    const topExamples = examples.slice(0, 10);
    topExamples.forEach((ex, i) => {
      prompt += `### Example ${i + 1}`;
      if (ex.performance) prompt += ` (${ex.performance})`;
      prompt += `\n`;
      if (ex.subject) prompt += `Subject: ${ex.subject}\n`;
      prompt += `${ex.body}\n\n`;
    });
  }

  return prompt;
}

async function callClaude(userPrompt, useWebSearch = true) {
  const tools = useWebSearch
    ? [{ type: "web_search_20250305", name: "web_search" }]
    : [];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: await buildSystemPrompt(),
    tools,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract the final text response (after any tool use)
  const textBlocks = response.content.filter((b) => b.type === "text");
  const fullText = textBlocks.map((b) => b.text).join("\n");

  // Parse JSON from response
  try {
    // Try to find JSON object in the response
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("Failed to parse JSON response, returning raw text");
  }

  return { body: fullText, subject: "Draft", researchNotes: "" };
}

// ═══════════════════════════════════════════════════════════════
// DRAFT ALL PROSPECT EMAILS
// ═══════════════════════════════════════════════════════════════

async function draftProspectEmails() {
  const limit = parseInt(process.env.DAILY_PROSPECT_COUNT || "20");
  console.log(`\n📧 Fetching ${limit} queued prospects from Google Sheets...`);

  let prospects;
  try {
    prospects = await getQueuedProspects(limit);
  } catch (err) {
    console.warn(`⚠️  Could not read Google Sheets: ${err.message}`);
    console.log("   Falling back to sample data...");
    const samplePath = "./data/prospects-sample.json";
    if (fs.existsSync(samplePath)) {
      prospects = JSON.parse(fs.readFileSync(samplePath, "utf-8")).slice(0, limit);
    } else {
      console.log("   No sample data found. Skipping prospect emails.");
      return [];
    }
  }

  console.log(`   Found ${prospects.length} prospects to draft.`);
  const drafts = [];

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];
    console.log(`   [${i + 1}/${prospects.length}] Drafting for ${prospect.name} (${prospect.company})...`);

    try {
      const result = await callClaude(PROSPECT_PROMPT(prospect), true);

      drafts.push({
        id: `prospect-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "email",
        category: "Prospect Outreach",
        recipient: prospect.name,
        recipientTitle: `${prospect.title}, ${prospect.company}`,
        recipientEmail: prospect.email,
        subject: result.subject || "Draft",
        body: result.body || "",
        researchNotes: result.researchNotes || "",
        status: "pending",
        scheduledTime: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        meta: {
          company: prospect.company,
          rowIndex: prospect.rowIndex,
          generatedAt: new Date().toISOString(),
        },
      });

      // Update status in Google Sheet
      if (prospect.rowIndex) {
        try {
          await updateProspectStatus(prospect.rowIndex, "drafted");
        } catch (e) {
          // Non-fatal: sheet update failed
        }
      }

      console.log(`   ✓ ${prospect.name} — "${result.subject}"`);

      // Rate limiting: 1 second between API calls
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`   ✗ ${prospect.name}: ${err.message}`);
    }
  }

  return drafts;
}

// ═══════════════════════════════════════════════════════════════
// DRAFT ALL STAY-IN-TOUCH EMAILS
// ═══════════════════════════════════════════════════════════════

async function draftStayInTouchEmails() {
  const limit = parseInt(process.env.DAILY_CONTACT_COUNT || "5");
  console.log(`\n💌 Fetching ${limit} contacts due for outreach...`);

  let contacts;
  try {
    contacts = await getContactsDueForOutreach(limit);
  } catch (err) {
    console.warn(`⚠️  Could not read Google Sheets: ${err.message}`);
    console.log("   Falling back to sample data...");
    const samplePath = "./data/contacts-sample.json";
    if (fs.existsSync(samplePath)) {
      contacts = JSON.parse(fs.readFileSync(samplePath, "utf-8")).slice(0, limit);
    } else {
      return [];
    }
  }

  console.log(`   Found ${contacts.length} contacts to draft.`);
  const drafts = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    console.log(`   [${i + 1}/${contacts.length}] Drafting for ${contact.name}...`);

    try {
      const result = await callClaude(STAY_IN_TOUCH_PROMPT(contact), true);

      drafts.push({
        id: `network-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "email",
        category: "Stay in Touch",
        recipient: contact.name,
        recipientTitle: `${contact.title}, ${contact.company}`,
        recipientEmail: contact.email,
        subject: result.subject || "Draft",
        body: result.body || "",
        researchNotes: result.researchNotes || "",
        status: "pending",
        scheduledTime: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        meta: {
          relationship: contact.relationship,
          rowIndex: contact.rowIndex,
          generatedAt: new Date().toISOString(),
        },
      });

      console.log(`   ✓ ${contact.name} — "${result.subject}"`);
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`   ✗ ${contact.name}: ${err.message}`);
    }
  }

  return drafts;
}

// ═══════════════════════════════════════════════════════════════
// DRAFT ALL LINKEDIN COMMENTS
// ═══════════════════════════════════════════════════════════════

async function draftLinkedInComments() {
  const limit = parseInt(process.env.DAILY_LINKEDIN_COUNT || "5");
  console.log(`\n💬 Loading ${limit} LinkedIn posts...`);

  const posts = getLinkedInPosts(limit);
  if (posts.length === 0) {
    console.log("   No LinkedIn posts found. Skipping.");
    return [];
  }

  console.log(`   Found ${posts.length} posts to comment on.`);
  const drafts = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`   [${i + 1}/${posts.length}] Drafting comment for ${post.author}'s post...`);

    try {
      const result = await callClaude(LINKEDIN_COMMENT_PROMPT(post), false);

      drafts.push({
        id: `linkedin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "linkedin",
        category: "LinkedIn Engagement",
        recipient: post.author,
        recipientTitle: post.authorTitle || "",
        subject: `Re: ${(post.content || "").substring(0, 60)}...`,
        body: result.comment || result.body || "",
        researchNotes: result.researchNotes || "",
        status: "pending",
        scheduledTime: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        meta: {
          postUrl: post.url || "",
          engagement: `${post.likes || "?"} likes, ${post.comments || "?"} comments`,
          generatedAt: new Date().toISOString(),
        },
      });

      console.log(`   ✓ ${post.author}`);
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`   ✗ ${post.author}: ${err.message}`);
    }
  }

  return drafts;
}

// ═══════════════════════════════════════════════════════════════
// MAIN: GENERATE ALL DAILY DRAFTS
// ═══════════════════════════════════════════════════════════════

export async function generateAllDrafts() {
  const startTime = Date.now();
  console.log("═══════════════════════════════════════════════════");
  console.log("  OVERALLS DAILY OUTREACH — DRAFT GENERATION");
  console.log(`  ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`);
  console.log("═══════════════════════════════════════════════════");

  dailyProgress = { active: true, current: "Drafting prospect emails...", completed: 0, total: 3, percent: 0 };

  const prospectDrafts = await draftProspectEmails();
  dailyProgress = { ...dailyProgress, current: "Drafting stay-in-touch emails...", completed: 1, percent: 33 };

  const contactDrafts = await draftStayInTouchEmails();
  dailyProgress = { ...dailyProgress, current: "Drafting LinkedIn comments...", completed: 2, percent: 66 };
  // Fetch fresh LinkedIn posts via Apify before drafting comments
  try {
    await fetchLinkedInPosts();
  } catch (err) {
    console.warn("⚠️  Apify LinkedIn fetch failed, using existing posts:", err.message);
  }
  const linkedinDrafts = await draftLinkedInComments();

  const allDrafts = [...prospectDrafts, ...contactDrafts, ...linkedinDrafts];

  // Save to daily file
  const dateStr = new Date().toISOString().split("T")[0];
  const outputPath = `./data/drafts-${dateStr}.json`;

  // Create data directory if it doesn't exist
  if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data", { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(allDrafts, null, 2));

  // Also save as "latest" for the API server to pick up
  fs.writeFileSync("./data/drafts-latest.json", JSON.stringify(allDrafts, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  ✅ COMPLETE: ${allDrafts.length} drafts generated in ${elapsed}s`);
  console.log(`     📧 ${prospectDrafts.length} prospect emails`);
  console.log(`     💌 ${contactDrafts.length} stay-in-touch emails`);
  console.log(`     💬 ${linkedinDrafts.length} LinkedIn comments`);
  console.log(`     💾 Saved to ${outputPath}`);
  console.log("     🖥️  Open http://localhost:3000 to review and approve");
  console.log("═══════════════════════════════════════════════════\n");

  dailyProgress = { active: false, current: "Complete", completed: 3, total: 3, percent: 100 };

  return allDrafts;
}
