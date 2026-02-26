import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Team() {
  const { apiFetch } = useAuth();
  const [members, setMembers] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await apiFetch("/api/team");
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error("Failed to fetch team:", err);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch("/api/team/invite", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Invited ${data.user.name} (${data.user.email})`);
      setForm({ name: "", email: "", password: "", role: "member" });
      setShowInvite(false);
      fetchMembers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #E8E6E1",
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "20px 28px", maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Team Members</h2>
          <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0 0" }}>
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
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
          + Invite Member
        </button>
      </div>

      {success && (
        <div style={{ padding: "10px 14px", background: "#D1FAE5", color: "#065F46", borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
          {success}
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E6E1", padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px 0" }}>Invite Team Member</h3>
          {error && (
            <div style={{ padding: "8px 12px", background: "#FEE2E2", color: "#991B1B", borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleInvite}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#888", display: "block", marginBottom: 4 }}>NAME</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#888", display: "block", marginBottom: 4 }}>EMAIL</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#888", display: "block", marginBottom: 4 }}>PASSWORD</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#888", display: "block", marginBottom: 4 }}>ROLE</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inputStyle}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#1A1A1A", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                Send Invite
              </button>
              <button type="button" onClick={() => setShowInvite(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E8E6E1", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#666" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Members table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E6E1", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#FAFAF9", borderBottom: "1px solid #E8E6E1" }}>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Name</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Email</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Role</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#888", fontSize: 11 }}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #F2F0ED" }}>
                <td style={{ padding: "10px 16px", fontWeight: 600 }}>{m.name}</td>
                <td style={{ padding: "10px 16px", color: "#666" }}>{m.email}</td>
                <td style={{ padding: "10px 16px" }}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    background: m.role === "admin" ? "#FEF3C7" : "#E8E6E1",
                    color: m.role === "admin" ? "#92400E" : "#666",
                  }}>
                    {m.role}
                  </span>
                </td>
                <td style={{ padding: "10px 16px", color: "#999", fontSize: 12 }}>
                  {m.created_at ? new Date(m.created_at).toLocaleDateString() : "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
