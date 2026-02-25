import React, { useState, useMemo } from "react";

const API = "/api";

function buildPreviewSteps(config) {
  const { emails = 3, linkedinMessages = 0, textMessages = 0, daysBetween = 3 } = config;
  const totalSteps = emails + linkedinMessages + textMessages;
  const steps = [];
  let emailsLeft = emails;
  let linkedinLeft = linkedinMessages;
  let textLeft = textMessages;

  for (let i = 0; i < totalSteps; i++) {
    let modality;
    if (i === 0 && emailsLeft > 0) { modality = "email"; emailsLeft--; }
    else if (i % 3 === 2 && linkedinLeft > 0) { modality = "linkedin"; linkedinLeft--; }
    else if (i % 4 === 3 && textLeft > 0) { modality = "text"; textLeft--; }
    else if (emailsLeft > 0) { modality = "email"; emailsLeft--; }
    else if (linkedinLeft > 0) { modality = "linkedin"; linkedinLeft--; }
    else if (textLeft > 0) { modality = "text"; textLeft--; }

    steps.push({
      stepNumber: i + 1,
      modality,
      day: i * daysBetween,
    });
  }
  return steps;
}

const MODALITY_COLORS = {
  email: { bg: "#FFF8E1", color: "#8D6E00", border: "#FFE082" },
  linkedin: { bg: "#E8F0FE", color: "#1A65C0", border: "#B8D4F8" },
  text: { bg: "#F3E8FF", color: "#7C3AED", border: "#DDD6FE" },
};

export default function SequenceBuilder({ selectedLeads, onClose, onStarted }) {
  const [config, setConfig] = useState({
    emails: 5,
    linkedinMessages: 2,
    textMessages: 0,
    daysBetween: 3,
  });
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);

  const previewSteps = useMemo(() => buildPreviewSteps(config), [config]);
  const totalDrafts = selectedLeads.length * previewSteps.length;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/sequences/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: selectedLeads.map((l) => l.id),
          sequenceConfig: config,
          sequenceContext: context || undefined,
        }),
      });
      await res.json();
      if (onStarted) onStarted();
    } catch (err) {
      console.error("Failed to start sequence generation:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectStyle = {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #E8E6E1",
    background: "#fff",
    fontSize: 13,
    fontWeight: 500,
    width: "100%",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          width: 560,
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Build Sequence
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              color: "#999",
            }}
          >
            x
          </button>
        </div>

        <div
          style={{
            padding: "12px 16px",
            background: "#F8F7F4",
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 13,
            color: "#666",
          }}
        >
          Generating {previewSteps.length}-step sequences for{" "}
          <strong>{selectedLeads.length}</strong> leads (
          <strong>{totalDrafts}</strong> total messages)
        </div>

        {/* Config form */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <label
              style={{ fontSize: 11, fontWeight: 600, color: "#888", display: "block", marginBottom: 4 }}
            >
              EMAILS
            </label>
            <select
              value={config.emails}
              onChange={(e) => setConfig({ ...config, emails: Number(e.target.value) })}
              style={selectStyle}
            >
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{ fontSize: 11, fontWeight: 600, color: "#888", display: "block", marginBottom: 4 }}
            >
              LINKEDIN MESSAGES
            </label>
            <select
              value={config.linkedinMessages}
              onChange={(e) => setConfig({ ...config, linkedinMessages: Number(e.target.value) })}
              style={selectStyle}
            >
              {[...Array(6)].map((_, i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{ fontSize: 11, fontWeight: 600, color: "#888", display: "block", marginBottom: 4 }}
            >
              TEXT MESSAGES
            </label>
            <select
              value={config.textMessages}
              onChange={(e) => setConfig({ ...config, textMessages: Number(e.target.value) })}
              style={selectStyle}
            >
              {[...Array(4)].map((_, i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{ fontSize: 11, fontWeight: 600, color: "#888", display: "block", marginBottom: 4 }}
            >
              DAYS BETWEEN STEPS
            </label>
            <select
              value={config.daysBetween}
              onChange={(e) => setConfig({ ...config, daysBetween: Number(e.target.value) })}
              style={selectStyle}
            >
              {[1, 2, 3, 5, 7].map((d) => (
                <option key={d} value={d}>{d} days</option>
              ))}
            </select>
          </div>
        </div>

        {/* Context field */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{ fontSize: 11, fontWeight: 600, color: "#888", display: "block", marginBottom: 4 }}
          >
            ADDITIONAL CONTEXT (OPTIONAL)
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Add any specific instructions for this batch..."
            style={{
              width: "100%",
              minHeight: 60,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #E8E6E1",
              fontSize: 13,
              fontFamily: "inherit",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Sequence preview */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{ fontSize: 11, fontWeight: 600, color: "#888", display: "block", marginBottom: 8 }}
          >
            SEQUENCE PREVIEW
          </label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {previewSteps.map((step) => {
              const mc = MODALITY_COLORS[step.modality] || MODALITY_COLORS.email;
              return (
                <div
                  key={step.stepNumber}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: mc.bg,
                    color: mc.color,
                    border: `1px solid ${mc.border}`,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Step {step.stepNumber}:{" "}
                  {step.modality.charAt(0).toUpperCase() + step.modality.slice(1)}{" "}
                  (Day {step.day})
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #E8E6E1",
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#666",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              background: loading ? "#94A3B8" : "#1A1A1A",
              color: "#fff",
              cursor: loading ? "wait" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {loading ? "Starting..." : "Generate Sequences"}
          </button>
        </div>
      </div>
    </div>
  );
}
