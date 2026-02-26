import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import SequenceBuilder from "./SequenceBuilder.jsx";
import ProgressOverlay from "./ProgressOverlay.jsx";

const API = "/api";

const STATUS_COLORS = {
  not_contacted: { bg: "#F2F0ED", color: "#666" },
  drafted: { bg: "#FEF3C7", color: "#92400E" },
  approved: { bg: "#D1FAE5", color: "#065F46" },
  sent: { bg: "#DBEAFE", color: "#1E40AF" },
  replied: { bg: "#E0E7FF", color: "#3730A3" },
};

export default function LeadsManager() {
  const { apiFetch, user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const [showSequenceBuilder, setShowSequenceBuilder] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (assigneeFilter) params.set("assignedTo", assigneeFilter);
      const url = params.toString() ? `${API}/leads?${params}` : `${API}/leads`;
      const res = await apiFetch(url);
      const data = await res.json();
      setLeads(data.leads || []);
      setCounts(data.counts || {});
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, assigneeFilter, apiFetch]);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/team`);
      const data = await res.json();
      setTeamMembers(data.members || []);
    } catch (err) {
      console.error("Failed to fetch team:", err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Filtered leads
  const filtered = leads.filter((l) => {
    if (sourceFilter && l.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (l.name || "").toLowerCase().includes(q) ||
        (l.company || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sources = [...new Set(leads.map((l) => l.source).filter(Boolean))];

  // Selection helpers
  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((l) => l.id)));
    }
  };

  const selectFirstN = (n) => {
    setSelected(new Set(filtered.slice(0, n).map((l) => l.id)));
  };

  // Upload handler
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await apiFetch(`${API}/leads/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setUploadResult(
        `Added ${data.added} leads, ${data.duplicates} duplicates skipped. Total: ${data.total}`
      );
      fetchLeads();
      setTimeout(() => setUploadResult(null), 5000);
    } catch (err) {
      setUploadResult(`Upload failed: ${err.message}`);
    }
    e.target.value = "";
  };

  // Delete selected
  const handleDeleteSelected = async () => {
    for (const id of selected) {
      await apiFetch(`${API}/leads/${id}`, { method: "DELETE" });
    }
    setSelected(new Set());
    fetchLeads();
  };

  // Assign selected leads to a team member
  const handleAssign = async (userId) => {
    try {
      await apiFetch(`${API}/leads/assign`, {
        method: "POST",
        body: JSON.stringify({ leadIds: [...selected], userId }),
      });
      setSelected(new Set());
      fetchLeads();
    } catch (err) {
      console.error("Failed to assign leads:", err);
    }
  };

  // Export selected as CSV
  const handleExportSelected = () => {
    const selectedLeads = filtered.filter((l) => selected.has(l.id));
    const headers = ["name", "email", "title", "company", "status", "source"];
    const rows = selectedLeads.map((l) =>
      headers.map((h) => `"${(l[h] || "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const selectedLeadObjects = filtered.filter((l) => selected.has(l.id));
  const replyRate =
    (counts.sent || 0) > 0
      ? `${Math.round(((counts.replied || 0) / counts.sent) * 100)}%`
      : "--";

  return (
    <div style={{ padding: "20px 28px" }}>
      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Total", value: total, color: "#1A1A1A" },
          { label: "Not Contacted", value: counts.not_contacted || 0, color: "#666" },
          { label: "Drafted", value: counts.drafted || 0, color: "#92400E" },
          { label: "Sent", value: counts.sent || 0, color: "#1E40AF" },
          { label: "Reply Rate", value: replyRate, color: "#3730A3" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "12px 20px",
              background: "#fff",
              borderRadius: 10,
              border: "1px solid #E8E6E1",
              minWidth: 100,
            }}
          >
            <div style={{ fontSize: 11, color: "#888", fontWeight: 600, marginBottom: 2 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Upload area */}
      <div
        style={{
          border: "2px dashed #E8E6E1",
          borderRadius: 12,
          padding: 20,
          textAlign: "center",
          marginBottom: 20,
          background: "#FAFAF9",
        }}
      >
        <label
          style={{
            cursor: "pointer",
            display: "block",
          }}
        >
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleUpload}
            style={{ display: "none" }}
          />
          <div style={{ fontSize: 13, fontWeight: 600, color: "#666" }}>
            Drop CSV or XLSX here, or click to upload
          </div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
            Expected columns: name, email, title, company, industry, painSignal
          </div>
        </label>
        {uploadResult && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 16px",
              background: "#D1FAE5",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: "#065F46",
              display: "inline-block",
            }}
          >
            {uploadResult}
          </div>
        )}
      </div>

      {/* Progress overlay */}
      {showProgress && (
        <ProgressOverlay
          type="sequence"
          onComplete={() => {
            setShowProgress(false);
            fetchLeads();
          }}
        />
      )}

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Search name, company, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #E8E6E1",
            fontSize: 12,
            width: 220,
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setSelected(new Set()); }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #E8E6E1",
            fontSize: 12,
            background: "#fff",
          }}
        >
          <option value="">All statuses</option>
          <option value="not_contacted">Not contacted</option>
          <option value="drafted">Drafted</option>
          <option value="approved">Approved</option>
          <option value="sent">Sent</option>
          <option value="replied">Replied</option>
        </select>
        {sources.length > 0 && (
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #E8E6E1",
              fontSize: 12,
              background: "#fff",
            }}
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        {teamMembers.length > 1 && (
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #E8E6E1",
              fontSize: 12,
              background: "#fff",
            }}
          >
            <option value="">All assignees</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setAssigneeFilter(assigneeFilter === user.id ? "" : user.id)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #E8E6E1",
            fontSize: 12,
            fontWeight: 600,
            background: assigneeFilter === user.id ? "#1A1A1A" : "#fff",
            color: assigneeFilter === user.id ? "#fff" : "#666",
            cursor: "pointer",
          }}
        >
          My Leads
        </button>

        {/* Selection controls */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <select
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0) selectFirstN(n);
            }}
            value=""
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #E8E6E1",
              fontSize: 12,
              background: "#fff",
            }}
          >
            <option value="">Select first N...</option>
            {[10, 25, 50, 100, 250, 500, 1000].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>
            {selected.size} of {filtered.length} selected
          </span>
        </div>
      </div>

      {/* Action bar */}
      {selected.size > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            padding: "10px 16px",
            background: "#F8F7F4",
            borderRadius: 10,
            border: "1px solid #E8E6E1",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => setShowSequenceBuilder(true)}
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
            Draft for Selected ({selected.size})
          </button>
          <button
            onClick={handleExportSelected}
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
            Export Selected
          </button>
          {teamMembers.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) handleAssign(e.target.value);
                e.target.value = "";
              }}
              value=""
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #E8E6E1",
                fontSize: 12,
                background: "#fff",
                fontWeight: 600,
                color: "#666",
              }}
            >
              <option value="">Assign to...</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleDeleteSelected}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #FEE2E2",
              background: "#FFF5F5",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "#991B1B",
            }}
          >
            Delete Selected
          </button>
        </div>
      )}

      {/* Leads table */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #E8E6E1",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ background: "#FAFAF9", borderBottom: "1px solid #E8E6E1" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", width: 32 }}>
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === filtered.length}
                  onChange={selectAll}
                />
              </th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Name</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Email</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Title</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Company</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Status</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Step</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Assignee</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Source</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Imported</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#999" }}>
                  Loading leads...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#999" }}>
                  No leads yet -- upload a CSV or XLSX to get started
                </td>
              </tr>
            ) : (
              filtered.map((lead) => {
                const sc = STATUS_COLORS[lead.status] || STATUS_COLORS.not_contacted;
                return (
                  <tr
                    key={lead.id}
                    style={{
                      borderBottom: "1px solid #F2F0ED",
                      background: selected.has(lead.id) ? "#F8F7F4" : "#fff",
                    }}
                  >
                    <td style={{ padding: "8px 12px" }}>
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                      />
                    </td>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{lead.name}</td>
                    <td style={{ padding: "8px 12px", color: "#666" }}>{lead.email}</td>
                    <td style={{ padding: "8px 12px", color: "#666" }}>{lead.title}</td>
                    <td style={{ padding: "8px 12px", color: "#666" }}>{lead.company}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 700,
                          background: sc.bg,
                          color: sc.color,
                          textTransform: "uppercase",
                        }}
                      >
                        {lead.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#888", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                      Step {lead.sequence_step || lead.sequenceStep || 0}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#999", fontSize: 11 }}>
                      {lead.assigned_to
                        ? (teamMembers.find((m) => m.id === lead.assigned_to)?.name || "--")
                        : "--"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#999", fontSize: 11 }}>
                      {lead.source}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#999", fontSize: 11 }}>
                      {(lead.imported_at || lead.importedAt) ? new Date(lead.imported_at || lead.importedAt).toLocaleDateString() : "--"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Sequence Builder Modal */}
      {showSequenceBuilder && (
        <SequenceBuilder
          selectedLeads={selectedLeadObjects}
          onClose={() => setShowSequenceBuilder(false)}
          onStarted={() => {
            setShowSequenceBuilder(false);
            setShowProgress(true);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
