import React from "react";

const TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Ready" },
  { key: "sent", label: "Sent" },
  { key: "deleted", label: "Removed" },
];

export default function FilterBar({ filter, counts, onFilterChange }) {
  return (
    <div
      style={{
        padding: "0 28px",
        background: "#FFFFFF",
        borderBottom: "1px solid #E8E6E1",
        display: "flex",
        gap: 0,
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onFilterChange(tab.key)}
          style={{
            padding: "12px 16px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            color: filter === tab.key ? "#1A1A1A" : "#999",
            borderBottom:
              filter === tab.key
                ? "2px solid #1A1A1A"
                : "2px solid transparent",
          }}
        >
          {tab.label}
          {(counts[tab.key] || 0) > 0 && (
            <span
              style={{
                marginLeft: 6,
                padding: "1px 6px",
                borderRadius: 8,
                background: filter === tab.key ? "#1A1A1A" : "#E8E6E1",
                color: filter === tab.key ? "#fff" : "#666",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {counts[tab.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
