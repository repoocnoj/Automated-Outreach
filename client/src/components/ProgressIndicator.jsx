import React, { useState, useEffect } from "react";

const API = "/api";

export default function ProgressIndicator({ type, onComplete }) {
  const [progress, setProgress] = useState(null);
  const [startTime] = useState(Date.now());

  const endpoint =
    type === "sequence" ? `${API}/sequences/progress` : `${API}/progress`;

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(endpoint);
        const data = await res.json();
        setProgress(data);

        if (
          data.percentComplete >= 100 ||
          (data.active === false && data.percentComplete > 0)
        ) {
          setTimeout(() => {
            clearInterval(interval);
            if (onComplete) onComplete();
          }, 2000);
        }
      } catch (err) {
        // Silently retry
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [endpoint, onComplete]);

  if (!progress || (!progress.active && progress.percentComplete === 0)) {
    return null;
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const estimatedTotal =
    progress.percentComplete > 5
      ? Math.round(elapsed / (progress.percentComplete / 100))
      : null;
  const remaining = estimatedTotal ? estimatedTotal - elapsed : null;

  const isSequence = type === "sequence";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E8E6E1",
        borderRadius: 12,
        padding: 24,
        margin: "16px 28px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {progress.active
            ? isSequence
              ? "Generating Sequences..."
              : "Generating Drafts..."
            : "Generation Complete"}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: progress.percentComplete >= 100 ? "#047857" : "#666",
          }}
        >
          {progress.percentComplete}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          height: 8,
          background: "#F2F0ED",
          borderRadius: 4,
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: `${progress.percentComplete}%`,
            height: "100%",
            background:
              progress.percentComplete >= 100
                ? "#047857"
                : "linear-gradient(90deg, #1A1A1A, #444)",
            borderRadius: 4,
            transition: "width 0.5s ease",
          }}
        />
      </div>

      {/* Status details */}
      <div style={{ fontSize: 12, color: "#666", lineHeight: 1.8 }}>
        {isSequence && progress.currentLead && (
          <div>
            <strong>Lead:</strong> {progress.currentLead}
          </div>
        )}
        {progress.currentStep && progress.currentStep !== "Complete" && (
          <div>
            <strong>Step:</strong> {progress.currentStep}
          </div>
        )}
        {isSequence && (
          <div>
            <strong>Progress:</strong> {progress.completedLeads || 0} of{" "}
            {progress.totalLeads || 0} leads ·{" "}
            {(progress.completedLeads || 0) * (progress.totalSteps || 0) +
              (progress.completedSteps || 0)}{" "}
            of {(progress.totalLeads || 0) * (progress.totalSteps || 0)} drafts
          </div>
        )}
        {!isSequence && progress.current && (
          <div>
            <strong>Status:</strong> {progress.current}
          </div>
        )}
        {remaining && remaining > 0 && progress.active && (
          <div style={{ color: "#999" }}>
            Est. {Math.floor(remaining / 60)}m {remaining % 60}s remaining
          </div>
        )}
      </div>

      {/* Log (sequence only) */}
      {isSequence && progress.log && progress.log.length > 0 && (
        <div
          style={{
            marginTop: 12,
            maxHeight: 120,
            overflowY: "auto",
            background: "#FAFAF9",
            borderRadius: 8,
            padding: 10,
            fontSize: 11,
            fontFamily: "'DM Mono', monospace",
            color: "#666",
            lineHeight: 1.6,
          }}
        >
          {progress.log.slice(-10).map((entry, i) => (
            <div key={i}>{entry.message}</div>
          ))}
        </div>
      )}

      {/* Complete state */}
      {!progress.active && progress.percentComplete >= 100 && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 8,
          }}
        >
          {onComplete && (
            <button
              onClick={onComplete}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#1A1A1A",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              View Drafts
            </button>
          )}
          <button
            onClick={() => {
              window.location.href = "/api/export/csv";
            }}
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
            Export CSV
          </button>
        </div>
      )}
    </div>
  );
}
