import React from "react";

export default function Header({
  counts,
  onApproveAll,
  onSendAll,
  onGenerate,
  sendingAll,
  generating,
}) {
  return (
    <div
      style={{
        padding: "20px 28px",
        borderBottom: "1px solid #E8E6E1",
        background: "#FFFFFF",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#1A1A1A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            O
          </div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Outreach Command Center
          </h1>
        </div>
        <p
          style={{
            margin: "4px 0 0 42px",
            fontSize: 12,
            color: "#888",
            fontWeight: 500,
          }}
        >
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          {" · "}
          {counts.pending} pending · {counts.approved} ready to send
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onGenerate}
          disabled={generating}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #E8E6E1",
            background: "#fff",
            cursor: generating ? "wait" : "pointer",
            fontSize: 12,
            fontWeight: 600,
            color: "#666",
          }}
        >
          {generating ? "⏳ Generating..." : "⚡ Generate Drafts"}
        </button>
        {counts.pending > 0 && (
          <button
            onClick={onApproveAll}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #E8E6E1",
              background: "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "#047857",
            }}
          >
            ✓ Approve All ({counts.pending})
          </button>
        )}
        {counts.approved > 0 && (
          <button
            onClick={onSendAll}
            disabled={sendingAll}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: sendingAll ? "#94A3B8" : "#1A1A1A",
              color: "#fff",
              cursor: sendingAll ? "wait" : "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {sendingAll
              ? "Sending..."
              : `Send ${counts.approved} Emails →`}
          </button>
        )}
      </div>
    </div>
  );
}
