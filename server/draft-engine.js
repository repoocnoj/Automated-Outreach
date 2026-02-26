import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import fs from "fs";
import pool from "./db.js";
import {
  VOICE_PROFILE,
  PROSPECT_PROMPT,
  LINKEDIN_COMMENT_PROMPT,
} from "./voice-profile.js";
import { fetchLinkedInPosts } from "./apify-linkedin.js";
import { getVoiceConfig, getEmailExamples } from "./voice-store.js";

dotenv.config();

const MODEL = "claude-sonnet-4-20250514";

// Lazy-init so the env var is guaranteed to be loaded
let _anthropic;
function getAnthropicClient() {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

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
  const config = await getVoiceConfig();
  const examples = await getEmailExamples();

  let prompt = VOICE_PROFILE;

  if (config.useCustom && config.customInstructions) {
    prompt += `\n\n## ADDITIONAL INSTRUCTIONS FROM USER\n${config.customInstructions}\n`;
  }

  if (examples.length > 0) {
    prompt += `\n\n## EXAMPLE EMAILS THAT HAVE PERFORMED WELL\nUse these as style references. Match their tone, structure, and approach:\n\n`;
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

  const response = await getAnthropicClient().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: await buildSystemPrompt(),
    tools,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  const fullText = textBlocks.map((b) => b.text).join("\n");

  try {
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
// HELPER: Save draft to PostgreSQL
// ═══════════════════════════════════════════════════════════════

async function saveDraftToDb(draft) {
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

// ═══════════════════════════════════════════════════════════════
// DRAFT ALL PROSPECT EMAILS (from uploaded leads)
// ═══════════════════════════════════════════════════════════════

async function draftProspectEmails() {
  const limit = parseInt(process.env.DAILY_PROSPECT_COUNT || "20");
  console.log(`\n📧 Fetching ${limit} queued prospects from database...`);

  let prospects;
  try {
    const result = await pool.query(
      "SELECT * FROM leads WHERE status = 'not_contacted' ORDER BY imported_at DESC LIMIT $1",
      [limit]
    );
    prospects = result.rows;
  } catch (err) {
    console.warn(`⚠️  Could not read database: ${err.message}`);
    console.log("   Falling back to sample data...");
    const samplePath = "./data/prospects-sample.json";
    if (fs.existsSync(samplePath)) {
      prospects = JSON.parse(fs.readFileSync(samplePath, "utf-8")).slice(0, limit);
    } else {
      console.log("   No prospects found. Skipping prospect emails.");
      return [];
    }
  }

  if (prospects.length === 0) {
    console.log("   No prospects found. Skipping.");
    return [];
  }

  console.log(`   Found ${prospects.length} prospects to draft.`);
  const drafts = [];

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];
    const name = prospect.name || "";
    const company = prospect.company || "";
    console.log(`   [${i + 1}/${prospects.length}] Drafting for ${name} (${company})...`);

    try {
      const result = await callClaude(PROSPECT_PROMPT({
        name,
        title: prospect.title || "",
        company,
        companySize: prospect.company_size || "",
        industry: prospect.industry || "",
        painSignal: prospect.pain_signal || "",
        linkedinUrl: prospect.linkedin_url || "",
        notes: prospect.notes || "",
        email: prospect.email || "",
      }), true);

      const draft = {
        id: `prospect-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        leadId: prospect.id || null,
        type: "email",
        category: "Prospect Outreach",
        recipient: name,
        recipientTitle: `${prospect.title || ""}, ${company}`,
        recipientEmail: prospect.email || "",
        subject: result.subject || "Draft",
        body: result.body || "",
        researchNotes: result.researchNotes || "",
        status: "pending",
        scheduledTime: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        meta: {
          company,
          generatedAt: new Date().toISOString(),
        },
      };

      await saveDraftToDb(draft);
      drafts.push(draft);

      console.log(`   ✓ ${name} — "${result.subject}"`);
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`   ✗ ${name}: ${err.message}`);
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

  // Load from local JSON file (populated by Apify)
  let posts = [];
  const postsPath = "./data/linkedin-posts.json";
  if (fs.existsSync(postsPath)) {
    try {
      posts = JSON.parse(fs.readFileSync(postsPath, "utf-8")).slice(0, limit);
    } catch (e) {
      console.warn("   Could not parse linkedin-posts.json");
    }
  }

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

      const draft = {
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
      };

      await saveDraftToDb(draft);
      drafts.push(draft);

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

  dailyProgress = { active: true, current: "Drafting prospect emails...", completed: 0, total: 2, percent: 0 };

  const prospectDrafts = await draftProspectEmails();
  dailyProgress = { ...dailyProgress, current: "Drafting LinkedIn comments...", completed: 1, percent: 50 };

  // Fetch fresh LinkedIn posts via Apify before drafting comments
  try {
    await fetchLinkedInPosts();
  } catch (err) {
    console.warn("⚠️  Apify LinkedIn fetch failed, using existing posts:", err.message);
  }
  const linkedinDrafts = await draftLinkedInComments();

  const allDrafts = [...prospectDrafts, ...linkedinDrafts];

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  ✅ COMPLETE: ${allDrafts.length} drafts generated in ${elapsed}s`);
  console.log(`     📧 ${prospectDrafts.length} prospect emails`);
  console.log(`     💬 ${linkedinDrafts.length} LinkedIn comments`);
  console.log("     🖥️  Open http://localhost:3000 to review and approve");
  console.log("═══════════════════════════════════════════════════\n");

  dailyProgress = { active: false, current: "Complete", completed: 2, total: 2, percent: 100 };

  return allDrafts;
}
