import pool from "./db.js";

export async function getVoiceConfig() {
  const result = await pool.query("SELECT * FROM voice_config WHERE id = 1");
  if (result.rows.length === 0) {
    return { customInstructions: "", useCustom: false };
  }
  return {
    customInstructions: result.rows[0].custom_instructions,
    useCustom: result.rows[0].use_custom,
  };
}

export async function saveVoiceConfig(config) {
  await pool.query(
    "UPDATE voice_config SET custom_instructions = $1, use_custom = $2, updated_at = NOW() WHERE id = 1",
    [config.customInstructions || "", config.useCustom || false]
  );
}

export async function getEmailExamples() {
  const result = await pool.query("SELECT * FROM email_examples ORDER BY added_at DESC");
  return result.rows;
}

export async function saveEmailExample(example) {
  await pool.query(
    "INSERT INTO email_examples (id, subject, body, recipient, category, performance) VALUES ($1, $2, $3, $4, $5, $6)",
    [
      example.id || `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      example.subject || "",
      example.body || "",
      example.recipient || "",
      example.category || "general",
      example.performance || "",
    ]
  );
}

export async function deleteEmailExample(id) {
  await pool.query("DELETE FROM email_examples WHERE id = $1", [id]);
}
