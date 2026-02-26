import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const API = "/api";

export default function Settings() {
  const { apiFetch } = useAuth();
  const [config, setConfig] = useState({ customInstructions: "", useCustom: false });
  const [examples, setExamples] = useState([]);
  const [saved, setSaved] = useState(false);
  const [showBaseProfile, setShowBaseProfile] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newExample, setNewExample] = useState({ subject: "", body: "", category: "", performance: "" });
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    fetchVoice();
  }, []);

  const fetchVoice = async () => {
    try {
      const res = await apiFetch(`${API}/voice`);
      const data = await res.json();
      setConfig(data.config || { customInstructions: "", useCustom: false });
      setExamples(data.examples || []);
    } catch (err) {
      console.error("Failed to fetch voice config:", err);
    }
  };

  const saveConfig = async () => {
    try {
      await apiFetch(`${API}/voice`, {
        method: "PUT",
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save voice config:", err);
    }
  };

  const handleExampleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await apiFetch(`${API}/voice/examples/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setUploadResult(`Added ${data.added} examples. Total: ${data.total}`);
      fetchVoice();
      setTimeout(() => setUploadResult(null), 4000);
    } catch (err) {
      setUploadResult(`Upload failed: ${err.message}`);
    }
    e.target.value = "";
  };

  const addExample = async () => {
    try {
      await apiFetch(`${API}/voice/examples`, {
        method: "POST",
        body: JSON.stringify(newExample),
      });
      setNewExample({ subject: "", body: "", category: "", performance: "" });
      setShowAddForm(false);
      fetchVoice();
    } catch (err) {
      console.error("Failed to add example:", err);
    }
  };

  const deleteExample = async (id) => {
    try {
      await apiFetch(`${API}/voice/examples/${id}`, { method: "DELETE" });
      fetchVoice();
    } catch (err) {
      console.error("Failed to delete example:", err);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #E8E6E1",
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "20px 28px", maxWidth: 800 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        Voice & Template Settings
      </h2>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
        Customize the AI voice profile and add example emails for better drafting
      </p>

      {/* Voice Instructions Editor */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #E8E6E1",
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            Custom Voice Instructions
          </h3>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={config.useCustom}
              onChange={(e) => setConfig({ ...config, useCustom: e.target.checked })}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>
              Use custom instructions
            </span>
          </label>
        </div>

        <p style={{ fontSize: 12, color: "#999", marginBottom: 12, marginTop: 0 }}>
          These instructions are added to the base voice profile. Use them to adjust tone,
          add new talking points, or change the approach.
        </p>

        <textarea
          value={config.customInstructions}
          onChange={(e) => setConfig({ ...config, customInstructions: e.target.value })}
          placeholder="Add custom instructions here... e.g., 'Focus more on ROI data' or 'Use a more casual tone for startups'"
          style={{
            ...inputStyle,
            minHeight: 150,
            resize: "vertical",
            marginBottom: 12,
            opacity: config.useCustom ? 1 : 0.5,
          }}
          disabled={!config.useCustom}
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={saveConfig}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: "#1A1A1A",
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Save
          </button>
          {saved && (
            <span style={{ fontSize: 12, color: "#047857", fontWeight: 600 }}>
              Saved!
            </span>
          )}
        </div>
      </div>

      {/* Email Examples */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #E8E6E1",
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            Email Examples
          </h3>
          <span style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>
            {examples.length} example{examples.length !== 1 ? "s" : ""} loaded
          </span>
        </div>

        <p style={{ fontSize: 12, color: "#999", marginBottom: 16, marginTop: 0 }}>
          Upload emails that have performed well. The AI uses these as style references.
          Expected columns: subject, body, recipient, category, performance
        </p>

        {/* Upload area */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <label
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #E8E6E1",
              background: "#FAFAF9",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "#666",
            }}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleExampleUpload}
              style={{ display: "none" }}
            />
            Upload CSV/XLSX
          </label>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #E8E6E1",
              background: "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "#666",
            }}
          >
            Add Manually
          </button>
        </div>

        {uploadResult && (
          <div
            style={{
              padding: "8px 16px",
              background: "#D1FAE5",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: "#065F46",
              marginBottom: 12,
            }}
          >
            {uploadResult}
          </div>
        )}

        {/* Add example form */}
        {showAddForm && (
          <div
            style={{
              padding: 16,
              background: "#FAFAF9",
              borderRadius: 10,
              marginBottom: 16,
              border: "1px solid #E8E6E1",
            }}
          >
            <input
              type="text"
              placeholder="Subject line"
              value={newExample.subject}
              onChange={(e) => setNewExample({ ...newExample, subject: e.target.value })}
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            <textarea
              placeholder="Email body"
              value={newExample.body}
              onChange={(e) => setNewExample({ ...newExample, body: e.target.value })}
              style={{ ...inputStyle, minHeight: 100, resize: "vertical", marginBottom: 8 }}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Category (e.g., prospect, follow-up)"
                value={newExample.category}
                onChange={(e) => setNewExample({ ...newExample, category: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="text"
                placeholder="Performance (e.g., 45% reply rate)"
                value={newExample.performance}
                onChange={(e) => setNewExample({ ...newExample, performance: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={addExample}
                disabled={!newExample.body}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: newExample.body ? "#1A1A1A" : "#ccc",
                  color: "#fff",
                  cursor: newExample.body ? "pointer" : "default",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Add Example
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #E8E6E1",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#666",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Examples list */}
        {examples.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {examples.map((ex) => (
              <div
                key={ex.id}
                style={{
                  padding: "10px 14px",
                  background: "#FAFAF9",
                  borderRadius: 8,
                  border: "1px solid #F2F0ED",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                    {ex.subject || "(No subject)"}
                  </div>
                  <div style={{ fontSize: 11, color: "#999" }}>
                    {ex.category && <span style={{ marginRight: 8 }}>{ex.category}</span>}
                    {ex.performance && (
                      <span style={{ color: "#047857", fontWeight: 600 }}>{ex.performance}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteExample(ex.id)}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "#999",
                    padding: "4px 8px",
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Base Voice Profile */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #E8E6E1",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setShowBaseProfile(!showBaseProfile)}
          style={{
            width: "100%",
            padding: "16px 24px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 15,
            fontWeight: 700,
            color: "#1A1A1A",
            textAlign: "left",
          }}
        >
          <span>Base Voice Profile (Read-only)</span>
          <span style={{ fontSize: 12, color: "#888" }}>
            {showBaseProfile ? "Collapse" : "Expand"}
          </span>
        </button>
        {showBaseProfile && (
          <div
            style={{
              padding: "0 24px 24px",
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              lineHeight: 1.7,
              color: "#555",
              whiteSpace: "pre-wrap",
              background: "#FAFAF9",
              borderTop: "1px solid #E8E6E1",
              maxHeight: 400,
              overflowY: "auto",
            }}
          >
            {`You are ghostwriting outreach messages as Jon, CEO and co-founder of Overalls.

## WHO JON IS
- Founder and CEO of Overalls, a benefits technology company
- Deeply mission-driven: his mother's caregiving crisis inspired the company
- Direct communicator who leads with specifics, never platitudes

## JON'S WRITING PATTERNS
- Opens with something specific about the RECIPIENT
- Uses concrete numbers and real examples
- Keeps emails under 200 words
- Asks exactly ONE question at the end
- Signs off with just "Jon"

## OVERALLS KEY MESSAGES
- LifeConcierge: human + AI that EXECUTES life logistics
- Not another app, portal, or resource hub -- actual resolution
- Solves "point solution bloat" -- one service replaces 5+ vendors

## ROI DATA
- 12.9x-27.3x ROI depending on plan structure
- 40%+ reduction in self-reported work-related stress

## REAL CLIENTS
Reddit, ThredUp, Forrester Research, Prudential, BBB, U of Pacific, Epic Staffing`}
          </div>
        )}
      </div>
    </div>
  );
}
