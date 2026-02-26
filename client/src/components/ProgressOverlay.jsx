import React, { useState, useEffect, useRef } from "react";

export default function ProgressOverlay({ type, onComplete, onExport }) {
  const [progress, setProgress] = useState(null);
  const [startTime] = useState(Date.now());
  const logEndRef = useRef(null);

  const endpoint =
    type === "sequence" ? "/api/sequences/progress" : "/api/progress";

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(endpoint);
        const data = await res.json();
        setProgress(data);

        if (data.percentComplete >= 100 || (data.active === false && data.percentComplete > 0)) {
          setTimeout(() => clearInterval(interval), 2000);
        }
      } catch (err) {
        // silently retry
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [endpoint]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [progress?.log?.length]);

  if (!progress || (!progress.active && progress.percentComplete === 0)) {
    return null;
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const estimatedTotal =
    progress.percentComplete > 5
      ? Math.round(elapsed / (progress.percentComplete / 100))
      : null;
  const remaining = estimatedTotal ? estimatedTotal - elapsed : null;
  const isComplete = !progress.active && progress.percentComplete >= 100;
  const isSequence = type === "sequence";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          width: 520,
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        {/* Spinner or checkmark */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {isComplete ? (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#D1FAE5",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                color: "#047857",
              }}
            >
              ✓
            </div>
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                border: "4px solid #E8E6E1",
                borderTop: "4px solid #1A1A1A",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto",
              }}
            />
          )}
        </div>

        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {isComplete
              ? "Generation Complete!"
              : isSequence
                ? "Generating Sequences..."
                : "Generating Drafts..."}
          </div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            {progress.percentComplete}% complete
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "100%",
            height: 8,
            background: "#F2F0ED",
            borderRadius: 4,
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: `${progress.percentComplete}%`,
              height: "100%",
              background: isComplete
                ? "#047857"
                : "linear-gradient(90deg, #1A1A1A, #444)",
              borderRadius: 4,
              transition: "width 0.5s ease",
            }}
          />
        </div>

        {/* Status details */}
        <div style={{ fontSize: 12, color: "#666", lineHeight: 2, marginBottom: 16 }}>
          {isSequence && progress.currentLead && !isComplete && (
            <div><strong>Lead:</strong> {progress.currentLead}</div>
          )}
          {progress.currentStep && progress.currentStep !== "Complete" && !isComplete && (
            <div>
              <strong>Step:</strong> {progress.currentStep}
            </div>
          )}
          {isSequence && (
            <div>
              <strong>Progress:</strong>{" "}
              {progress.completedLeads || 0} of {progress.totalLeads || 0} leads ·{" "}
              {(progress.completedLeads || 0) * (progress.totalSteps || 0) + (progress.completedSteps || 0)} of{" "}
              {(progress.totalLeads || 0) * (progress.totalSteps || 0)} drafts
            </div>
          )}
          {!isSequence && progress.current && !isComplete && (
            <div><strong>Status:</strong> {progress.current}</div>
          )}
          {remaining && remaining > 0 && progress.active && (
            <div style={{ color: "#999" }}>
              Est. {Math.floor(remaining / 60)}m {remaining % 60}s remaining
            </div>
          )}
        </div>

        {/* Log */}
        {isSequence && progress.log && progress.log.length > 0 && (
          <div
            ref={logEndRef}
            style={{
              maxHeight: 200,
              overflowY: "auto",
              background: "#FAFAF9",
              borderRadius: 8,
              padding: 12,
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              color: "#666",
              lineHeight: 1.6,
              marginBottom: 16,
              border: "1px solid #F2F0ED",
            }}
          >
            {progress.log.slice(-20).map((entry, i) => (
              <div key={i}>{entry.message}</div>
            ))}
          </div>
        )}

        {/* Complete actions */}
        {isComplete && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {onComplete && (
              <button
                onClick={onComplete}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#1A1A1A",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                View Drafts
              </button>
            )}
            <button
              onClick={() => {
                if (onExport) onExport();
                else window.location.href = "/api/export/csv";
              }}
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
              Export CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
