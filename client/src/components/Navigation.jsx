import React from "react";
import { useAuth } from "../context/AuthContext.jsx";

const BASE_TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "leads", label: "Leads" },
  { key: "settings", label: "Settings" },
];

export default function Navigation({ activeTab, onTabChange, user }) {
  const { logout } = useAuth();

  const tabs = user?.role === "admin"
    ? [...BASE_TABS, { key: "team", label: "Team" }]
    : BASE_TABS;

  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        background: "#1A1A1A",
        padding: "0 28px",
        alignItems: "center",
      }}
    >
      {tabs.map((tab) => (
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
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11, color: "#888" }}>
          {user?.name || user?.email}
        </span>
        <button
          onClick={logout}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #444",
            background: "transparent",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
            color: "#999",
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
