import React from "react";

const TYPE_STYLES = {
  linkedin: {
    bg: "#E8F0FE",
    color: "#1A65C0",
    border: "#B8D4F8",
    label: "LinkedIn",
  },
  email: {
    bg: "#FFF8E1",
    color: "#8D6E00",
    border: "#FFE082",
    label: "Email",
  },
};

const CATEGORY_COLORS = {
  "LinkedIn Engagement": { bg: "#F3E8FF", color: "#7C3AED", border: "#DDD6FE" },
  "Prospect Outreach": { bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  "Stay in Touch": { bg: "#FFF1F2", color: "#BE123C", border: "#FECDD3" },
};

const STATUS_STYLES = {
  pending: { bg: "#FEF3C7", color: "#92400E", icon: "⏳" },
  approved: { bg: "#D1FAE5", color: "#065F46", icon: "✓" },
  edited: { bg: "#DBEAFE", color: "#1E40AF", icon: "✎" },
  sent: { bg: "#E0E7FF", color: "#3730A3", icon: "→" },
  deleted: { bg: "#FEE2E2", color: "#991B1B", icon: "✕" },
};

export default function MessageCard({ message, isSelected, onClick }) {
  const ts = TYPE_STYLES[message.type] || TYPE_STYLES.email;
  const cc = CATEGORY_COLORS[message.category] || {
    bg: "#F5F5F5",
    color: "#666",
    border: "#DDD",
  };
  const ss = STATUS_STYLES[message.status] || STATUS_STYLES.pending;

  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid #F2F0ED",
        cursor: "pointer",
        background: isSelected ? "#F8F7F4" : "#fff",
        borderLeft: isSelected
          ? "3px solid #1A1A1A"
          : "3px solid transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 6,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              background: ts.bg,
              color: ts.color,
              border: `1px solid ${ts.border}`,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            {ts.label}
          </span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 600,
              background: cc.bg,
              color: cc.color,
              border: `1px solid ${cc.border}`,
            }}
          >
            {message.category}
          </span>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 8px",
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 700,
            background: ss.bg,
            color: ss.color,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {ss.icon} {message.status}
        </span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
        {message.recipient}
      </div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
        {message.recipientTitle}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#555",
          fontWeight: 500,
          marginBottom: 4,
        }}
      >
        {message.subject}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#AAA",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{(message.body || "").substring(0, 60)}...</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}>
          {message.scheduledTime}
        </span>
      </div>
    </div>
  );
}
