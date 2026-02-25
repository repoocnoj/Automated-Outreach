import fs from "fs";

const VOICE_PATH = "./data/voice-config.json";
const EXAMPLES_PATH = "./data/email-examples.json";

// Default voice config uses the existing VOICE_PROFILE from voice-profile.js
// but allows user overrides

export function getVoiceConfig() {
  if (!fs.existsSync(VOICE_PATH)) {
    return {
      customInstructions: "",
      useCustom: false,
    };
  }
  return JSON.parse(fs.readFileSync(VOICE_PATH, "utf-8"));
}

export function saveVoiceConfig(config) {
  if (!fs.existsSync("./data")) fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(VOICE_PATH, JSON.stringify(config, null, 2));
}

export function getEmailExamples() {
  if (!fs.existsSync(EXAMPLES_PATH)) return [];
  return JSON.parse(fs.readFileSync(EXAMPLES_PATH, "utf-8"));
}

export function saveEmailExamples(examples) {
  if (!fs.existsSync("./data")) fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(EXAMPLES_PATH, JSON.stringify(examples, null, 2));
}
