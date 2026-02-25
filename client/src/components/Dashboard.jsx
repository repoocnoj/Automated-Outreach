import React, { useState, useEffect, useCallback } from "react";
import Header from "./Header.jsx";
import FilterBar from "./FilterBar.jsx";
import MessageCard from "./MessageCard.jsx";
import MessageDetail from "./MessageDetail.jsx";

const API = "/api";

export default function Dashboard() {
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Fetch drafts from API ──────────────────────────────────
  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/drafts`);
      const data = await res.json();
      setMessages(data.drafts || []);
    } catch (err) {
      console.error("Failed to fetch drafts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
    // Poll every 10 seconds for updates
    const interval = setInterval(fetchDrafts, 10000);
    return () => clearInterval(interval);
  }, [fetchDrafts]);

  // ── Toast helper ───────────────────────────────────────────
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  // ── API helpers ────────────────────────────────────────────
  const apiPost = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const apiPatch = async (url, body) => {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  // ── Actions ────────────────────────────────────────────────
  const handleApprove = async (id) => {
    await apiPost(`${API}/drafts/${id}/approve`);
    await fetchDrafts();
    showToast("Message approved");
  };

  const handleDelete = async (id) => {
    await apiPost(`${API}/drafts/${id}/delete`);
    await fetchDrafts();
    if (selectedId === id) setSelectedId(null);
    showToast("Message removed", "error");
  };

  const handleRestore = async (id) => {
    await apiPost(`${API}/drafts/${id}/restore`);
    await fetchDrafts();
    showToast("Message restored");
  };

  const handleUpdate = async (id, updates) => {
    await apiPatch(`${API}/drafts/${id}`, updates);
    await fetchDrafts();
    showToast("Edits saved");
  };

  const handleApproveAll = async () => {
    const result = await apiPost(`${API}/approve-all`);
    await fetchDrafts();
    showToast(`${result.approved} messages approved`);
  };

  const handleSendAll = async () => {
    setSendingAll(true);
    try {
      const result = await apiPost(`${API}/send-all`);
      await fetchDrafts();
      showToast(`${result.sent} emails sent!`);
    } catch (err) {
      showToast("Send failed: " + err.message, "error");
    } finally {
      setSendingAll(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await apiPost(`${API}/generate`);
      showToast("Draft generation started — check back in a few minutes");
      // Poll more frequently while generating
      setTimeout(fetchDrafts, 30000);
      setTimeout(fetchDrafts, 60000);
      setTimeout(fetchDrafts, 120000);
      setTimeout(fetchDrafts, 180000);
    } catch (err) {
      showToast("Generation failed: " + err.message, "error");
    } finally {
      setTimeout(() => setGenerating(false), 5000);
    }
  };

  // ── Filtering & Counts ────────────────────────────────────
  const counts = {
    all: messages.filter((m) => m.status !== "deleted").length,
    pending: messages.filter((m) => m.status === "pending").length,
    approved: messages.filter(
      (m) => m.status === "approved" || m.status === "edited"
    ).length,
    sent: messages.filter((m) => m.status === "sent").length,
    deleted: messages.filter((m) => m.status === "deleted").length,
  };

  const filteredMessages = messages.filter((m) => {
    if (filter === "all") return m.status !== "deleted";
    if (filter === "pending") return m.status === "pending";
    if (filter === "approved")
      return m.status === "approved" || m.status === "edited";
    if (filter === "sent") return m.status === "sent";
    if (filter === "deleted") return m.status === "deleted";
    return true;
  });

  const selected = messages.find((m) => m.id === selectedId);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      style={{
        fontFamily: "'Instrument Sans', 'DM Sans', -apple-system, sans-serif",
        background: "#F8F7F4",
        minHeight: "100vh",
        color: "#1A1A1A",
      }}
    >
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 1000,
            padding: "12px 20px",
            borderRadius: 10,
            background: toast.type === "error" ? "#FEE2E2" : "#D1FAE5",
            color: toast.type === "error" ? "#991B1B" : "#065F46",
            fontWeight: 600,
            fontSize: 13,
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          }}
        >
          {toast.message}
        </div>
      )}

      <Header
        counts={counts}
        onApproveAll={handleApproveAll}
        onSendAll={handleSendAll}
        onGenerate={handleGenerate}
        sendingAll={sendingAll}
        generating={generating}
      />

      <FilterBar
        filter={filter}
        counts={counts}
        onFilterChange={setFilter}
      />

      <div style={{ display: "flex", height: "calc(100vh - 130px)" }}>
        {/* Message List */}
        <div
          style={{
            width: 380,
            minWidth: 380,
            borderRight: "1px solid #E8E6E1",
            overflowY: "auto",
            background: "#FFFFFF",
          }}
        >
          {loading ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "#999",
                fontSize: 13,
              }}
            >
              Loading drafts...
            </div>
          ) : filteredMessages.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "#999",
                fontSize: 13,
              }}
            >
              {messages.length === 0
                ? 'No drafts yet — click "Generate Drafts" to start'
                : "No messages in this view"}
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <MessageCard
                key={msg.id}
                message={msg}
                isSelected={selectedId === msg.id}
                onClick={() => setSelectedId(msg.id)}
              />
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div
          style={{ flex: 1, overflowY: "auto", background: "#F8F7F4" }}
        >
          <MessageDetail
            message={selected}
            onApprove={handleApprove}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onUpdate={handleUpdate}
          />
        </div>
      </div>
    </div>
  );
}
