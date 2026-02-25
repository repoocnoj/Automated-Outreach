import React, { useState } from "react";

export default function MessageDetail({
  message,
  onApprove,
  onDelete,
  onRestore,
  onUpdate,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [showResearch, setShowResearch] = useState(false);

  if (!message) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#999",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📨</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          Select a message to preview
        </div>
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditBody(message.body);
    setEditSubject(message.subject);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onUpdate(message.id, {
      body: editBody,
      subject: editSubject,
      status: "edited",
    });
    setIsEditing(false);
  };

  const canAct =
    message.status !== "sent" && message.status !== "deleted";

  return (
    <div style={{ padding: "24px 32px", maxWidth: 720 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              margin: "0 0 4px 0",
              letterSpacing: "-0.02em",
            }}
          >
            {message.recipient}
          </h2>
          <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
            {message.recipientTitle}
            {message.recipientEmail && ` · ${message.recipientEmail}`}
          </p>
        </div>
        {message.researchNotes && (
          <button
            onClick={() => setShowResearch(!showResearch)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #E8E6E1",
              background: showResearch ? "#F3E8FF" : "#fff",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: showResearch ? "#7C3AED" : "#666",
            }}
          >
            🔍 Research
          </button>
        )}
      </div>

      {/* Research Notes */}
      {showResearch && message.researchNotes && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 10,
            marginBottom: 16,
            background: "#F3E8FF",
            border: "1px solid #E9D5FF",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#7C3AED",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Research Notes
          </div>
          <div style={{ fontSize: 12, color: "#581C87", lineHeight: 1.6 }}>
            {message.researchNotes}
          </div>
        </div>
      )}

      {/* Subject */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#999",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            display: "block",
            marginBottom: 4,
          }}
        >
          {message.type === "linkedin" ? "Thread / Topic" : "Subject Line"}
        </label>
        {isEditing ? (
          <input
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #D4D4D4",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {message.subject}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#999",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            display: "block",
            marginBottom: 6,
          }}
        >
          Message Body
        </label>
        {isEditing ? (
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            style={{
              width: "100%",
              minHeight: 300,
              padding: "14px 18px",
              borderRadius: 10,
              border: "1px solid #D4D4D4",
              fontSize: 13,
              lineHeight: 1.7,
              fontFamily: "inherit",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <div
            style={{
              padding: "18px 22px",
              borderRadius: 10,
              background: "#FFFFFF",
              border: "1px solid #E8E6E1",
              fontSize: 13,
              lineHeight: 1.8,
              whiteSpace: "pre-wrap",
              color: "#333",
            }}
          >
            {message.body}
          </div>
        )}
      </div>

      {/* LinkedIn post link */}
      {message.type === "linkedin" && message.meta?.postUrl && (
        <div style={{ marginBottom: 16 }}>
          <a
            href={message.meta.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              color: "#1A65C0",
              textDecoration: "underline",
            }}
          >
            Open original LinkedIn post →
          </a>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "16px 0",
          borderTop: "1px solid #E8E6E1",
        }}
      >
        {isEditing ? (
          <>
            <button
              onClick={handleSaveEdit}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "#1A1A1A",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Save Changes
            </button>
            <button
              onClick={() => setIsEditing(false)}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid #E8E6E1",
                background: "#fff",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#666",
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {canAct && (
              <>
                <button
                  onClick={() => onApprove(message.id)}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 8,
                    border: "none",
                    background:
                      message.status === "approved" || message.status === "edited"
                        ? "#D1FAE5"
                        : "#047857",
                    color:
                      message.status === "approved" || message.status === "edited"
                        ? "#047857"
                        : "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {message.status === "approved" || message.status === "edited"
                    ? "✓ Approved"
                    : "Approve"}
                </button>
                <button
                  onClick={handleStartEdit}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "1px solid #E8E6E1",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  ✎ Edit
                </button>
                <button
                  onClick={() => onDelete(message.id)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "1px solid #FEE2E2",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#DC2626",
                  }}
                >
                  Remove
                </button>
              </>
            )}
            {message.status === "deleted" && (
              <button
                onClick={() => onRestore(message.id)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid #E8E6E1",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ↩ Restore
              </button>
            )}
            {message.status === "sent" && (
              <div
                style={{
                  fontSize: 12,
                  color: "#888",
                  fontStyle: "italic",
                  padding: "10px 0",
                }}
              >
                ✓ Sent{" "}
                {message.sentAt
                  ? `at ${new Date(message.sentAt).toLocaleTimeString()}`
                  : ""}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
