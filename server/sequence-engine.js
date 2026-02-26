import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import pool from "./db.js";
import { buildSequenceSteps } from "./sequence-builder.js";
import {
  VOICE_PROFILE,
  SEQUENCE_EMAIL_PROMPT,
  SEQUENCE_LINKEDIN_PROMPT,
  SEQUENCE_TEXT_PROMPT,
} from "./voice-profile.js";
import { getVoiceConfig, getEmailExamples } from "./voice-store.js";
import { updateLeadStatus, updateLeadSequenceStep } from "./leads-store.js";

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

// Progress tracking — stored in memory, exposed via API
let currentProgress = {
  active: false,
  totalLeads: 0,
  completedLeads: 0,
  currentLead: "",
  totalSteps: 0,
  completedSteps: 0,
  currentStep: "",
  percentComplete: 0,
  log: [],
};

export function getProgress() {
  return { ...currentProgress };
}

function updateProgress(updates) {
  Object.assign(currentProgress, updates);
  if (currentProgress.totalLeads > 0 && currentProgress.totalSteps > 0) {
    const totalWork = currentProgress.totalLeads * currentProgress.totalSteps;
    const doneWork =
      currentProgress.completedLeads * currentProgress.totalSteps +
      currentProgress.completedSteps;
    currentProgress.percentComplete = Math.round((doneWork / totalWork) * 100);
  }
}

function logProgress(message) {
  currentProgress.log.push({
    time: new Date().toISOString(),
    message,
  });
  console.log(`   ${message}`);
}

async function saveDraftToDb(draft) {
  await pool.query(
    `INSERT INTO drafts (id, lead_id, type, category, recipient, recipient_title, recipient_email, subject, body, research_notes, status, sequence_step, total_steps, day, modality, scheduled_time, assigned_to, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (id) DO UPDATE SET
       subject = EXCLUDED.subject, body = EXCLUDED.body, status = EXCLUDED.status, updated_at = NOW()`,
    [
      draft.id, draft.leadId || null, draft.type, draft.category,
      draft.recipient, draft.recipientTitle || "", draft.recipientEmail || "",
      draft.subject || "", draft.body || "", draft.researchNotes || "",
      draft.status || "pending", draft.sequenceStep || null,
      draft.totalSteps || null, draft.day || null,
      draft.modality || draft.type, draft.scheduledTime || "",
      draft.assignedTo || null, JSON.stringify(draft.meta || {}),
    ]
  );
}

async function buildSystemPrompt() {
  const config = await getVoiceConfig();
  const examples = await getEmailExamples();

  let prompt = VOICE_PROFILE;

  if (config.useCustom && config.customInstructions) {
    prompt += `\n\n## ADDITIONAL INSTRUCTIONS FROM USER\n${config.customInstructions}\n`;
  }

  if (examples.length > 0) {
    prompt += `\n\n## EXAMPLE EMAILS THAT HAVE PERFORMED WELL\n`;
    examples.slice(0, 10).forEach((ex, i) => {
      prompt += `### Example ${i + 1}`;
      if (ex.performance) prompt += ` (${ex.performance})`;
      prompt += `\nSubject: ${ex.subject || "N/A"}\n${ex.body}\n\n`;
    });
  }

  return prompt;
}

async function callClaude(userPrompt, useWebSearch = false) {
  const tools = useWebSearch
    ? [{ type: "web_search_20250305", name: "web_search" }]
    : [];

  const systemPrompt = await buildSystemPrompt();

  const response = await getAnthropicClient().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    tools,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  const fullText = textBlocks.map((b) => b.text).join("\n");

  try {
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn("Failed to parse JSON, returning raw text");
  }

  return { body: fullText, subject: "Draft", researchNotes: "" };
}

// Generate full sequence for a single lead
async function generateSequenceForLead(lead, steps, sequenceContext) {
  const completedSteps = [];

  // Normalize lead fields (PostgreSQL rows use snake_case)
  const leadData = {
    id: lead.id,
    name: lead.name || "",
    title: lead.title || "",
    company: lead.company || "",
    companySize: lead.company_size || lead.companySize || "",
    industry: lead.industry || "",
    painSignal: lead.pain_signal || lead.painSignal || "",
    notes: lead.notes || "",
    email: lead.email || "",
  };

  for (const step of steps) {
    updateProgress({
      currentStep: step.label,
      completedSteps: step.stepNumber - 1,
    });
    logProgress(`${leadData.name}: Drafting ${step.label}...`);

    let prompt;
    let result;
    const useSearch = step.stepNumber === 1;

    if (step.modality === "email") {
      prompt = SEQUENCE_EMAIL_PROMPT(leadData, step.stepNumber, steps.length, completedSteps, sequenceContext);
      result = await callClaude(prompt, useSearch);
    } else if (step.modality === "linkedin") {
      prompt = SEQUENCE_LINKEDIN_PROMPT(leadData, step.stepNumber, steps.length, completedSteps);
      result = await callClaude(prompt, false);
    } else if (step.modality === "text") {
      prompt = SEQUENCE_TEXT_PROMPT(leadData, step.stepNumber, steps.length, completedSteps);
      result = await callClaude(prompt, false);
    }

    const draft = {
      id: `seq-${lead.id}-s${step.stepNumber}-${Date.now()}`,
      leadId: lead.id,
      type: step.modality,
      category: "Sequence",
      recipient: leadData.name,
      recipientTitle: `${leadData.title}, ${leadData.company}`,
      recipientEmail: leadData.email,
      subject: result.subject || "",
      body: result.body || result.comment || "",
      researchNotes: result.researchNotes || "",
      status: "pending",
      sequenceStep: step.stepNumber,
      totalSteps: steps.length,
      day: step.day,
      modality: step.modality,
      scheduledTime: `Day ${step.day}`,
      assignedTo: lead.assigned_to || null,
      meta: {
        sequenceConfig: { step: step.stepNumber, total: steps.length, day: step.day },
        generatedAt: new Date().toISOString(),
      },
    };

    await saveDraftToDb(draft);

    completedSteps.push({
      stepNumber: step.stepNumber,
      modality: step.modality,
      subject: draft.subject,
      body: draft.body,
    });

    logProgress(`✓ ${leadData.name}: ${step.label} — "${draft.subject || draft.body.substring(0, 40)}..."`);

    await new Promise((r) => setTimeout(r, 1000));

    step.draft = draft;
  }

  if (lead.id) {
    await updateLeadStatus(lead.id, "drafted");
    await updateLeadSequenceStep(lead.id, steps.length);
  }

  return steps.map((s) => s.draft);
}

// Generate sequences for multiple leads
export async function generateSequences(leads, sequenceConfig, sequenceContext) {
  const steps = buildSequenceSteps(sequenceConfig);

  updateProgress({
    active: true,
    totalLeads: leads.length,
    completedLeads: 0,
    currentLead: "",
    totalSteps: steps.length,
    completedSteps: 0,
    currentStep: "",
    percentComplete: 0,
    log: [],
  });

  logProgress(`Starting sequence generation: ${leads.length} leads × ${steps.length} steps = ${leads.length * steps.length} total drafts`);
  logProgress(`Sequence: ${steps.map((s) => s.label).join(" → ")}`);

  const allDrafts = [];

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    updateProgress({
      currentLead: `${lead.name} (${lead.company})`,
      completedLeads: i,
      completedSteps: 0,
    });
    logProgress(`\n[${i + 1}/${leads.length}] Processing ${lead.name} (${lead.company})...`);

    try {
      const drafts = await generateSequenceForLead(lead, [...steps], sequenceContext);
      allDrafts.push(...drafts);
    } catch (err) {
      logProgress(`✗ ${lead.name}: ${err.message}`);
    }
  }

  updateProgress({
    active: false,
    completedLeads: leads.length,
    percentComplete: 100,
    currentStep: "Complete",
  });

  logProgress(`\n✅ COMPLETE: Generated ${allDrafts.length} drafts for ${leads.length} leads`);

  return allDrafts;
}
