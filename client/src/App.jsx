import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Navigation from "./components/Navigation.jsx";
import Dashboard from "./components/Dashboard.jsx";
import LeadsManager from "./components/LeadsManager.jsx";
import Settings from "./components/Settings.jsx";
import Team from "./components/Team.jsx";
import Login from "./components/Login.jsx";

function AppContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!user) return <Login />;

  return (
    <div
      style={{
        fontFamily: "'Instrument Sans', 'DM Sans', -apple-system, sans-serif",
        minHeight: "100vh",
        background: "#F8F7F4",
        color: "#1A1A1A",
      }}
    >
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} user={user} />
      {activeTab === "dashboard" && <Dashboard />}
      {activeTab === "leads" && <LeadsManager />}
      {activeTab === "settings" && <Settings />}
      {activeTab === "team" && <Team />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
