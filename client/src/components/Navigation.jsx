import React from "react";

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "leads", label: "Leads" },
  { key: "settings", label: "Settings" },
];

export default function Navigation({ activeTab, onTabChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        background: "#1A1A1A",
        padding: "0 28px",
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          style={{
            padding: "10px 20px",
            border: "none",
            background: activeTab === tab.key ? "#333" : "transparent",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            color: activeTab === tab.key ? "#fff" : "#999",
            borderBottom:
              activeTab === tab.key
                ? "2px solid #fff"
                : "2px solid transparent",
            transition: "all 0.15s ease",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
