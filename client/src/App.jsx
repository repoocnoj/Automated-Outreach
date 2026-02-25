import React, { useState } from "react";
import Navigation from "./components/Navigation.jsx";
import Dashboard from "./components/Dashboard.jsx";
import LeadsManager from "./components/LeadsManager.jsx";
import Settings from "./components/Settings.jsx";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div
      style={{
        fontFamily: "'Instrument Sans', 'DM Sans', -apple-system, sans-serif",
        minHeight: "100vh",
        background: "#F8F7F4",
        color: "#1A1A1A",
      }}
    >
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "dashboard" && <Dashboard />}
      {activeTab === "leads" && <LeadsManager />}
      {activeTab === "settings" && <Settings />}
    </div>
  );
}
