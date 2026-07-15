"use client";
import { useCallback, useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "viewer" | "tester";
  is_active: boolean;
  created_at: string;
  last_sign_in: string | null;
  mfa_enabled: boolean;
  invited: boolean;
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:  { bg: "#2d1b69", text: "#a78bfa" },
  viewer: { bg: "#1a2e1a", text: "#4ade80" },
  tester: { bg: "#1a1f2e", text: "#93c5fd" },
};

function Badge({
  label,
  bg,
  text,
}: {
  label: string;
  bg: string;
  text: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color: text,
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </span>
  );
}

function fmt(dateStr: string | null) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function UsersView({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "viewer" | "tester">("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    } else {
      setError("Failed to load users");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function updateUser(id: string, patch: Partial<Pick<User, "role" | "is_active">>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    }
  }

  async function deleteUser(id: string, email: string) {
    if (!confirm(`Remove ${email} from the dashboard? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to remove user");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole }),
    });

    const data = await res.json();

    if (!res.ok) {
      setInviteError(data.error ?? "Invite failed");
      setInviting(false);
      return;
    }

    setInviteSuccess(`Invite sent to ${inviteEmail}`);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("viewer");
    setInviting(false);
    fetchUsers();
  }

  const card = {
    background: "#111118",
    border: "1px solid #1e1e2e",
    borderRadius: 12,
    padding: 24,
  };

  const input: React.CSSProperties = {
    padding: "9px 12px",
    background: "#0d0d14",
    border: "1px solid #2d2d3d",
    borderRadius: 8,
    color: "#f0f0ff",
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ color: "#f0f0ff", fontSize: 22, fontWeight: 700, margin: 0 }}>
            User Management
          </h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>
            {users.length} user{users.length !== 1 ? "s" : ""} · manage access and roles
          </p>
        </div>
        <button
          onClick={() => {
            setShowInvite((v) => !v);
            setInviteSuccess("");
            setInviteError("");
          }}
          style={{
            padding: "9px 18px",
            background: "#6366f1",
            border: "none",
            borderRadius: 8,
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Invite user
        </button>
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div style={card}>
          <h2 style={{ color: "#f0f0ff", fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>
            Invite new user
          </h2>
          <form onSubmit={handleInvite}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px auto", gap: 12, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", color: "#9ca3af", fontSize: 12, marginBottom: 5 }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@company.com"
                  required
                  style={input}
                />
              </div>
              <div>
                <label style={{ display: "block", color: "#9ca3af", fontSize: 12, marginBottom: 5 }}>
                  Full name
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jane Smith"
                  style={input}
                />
              </div>
              <div>
                <label style={{ display: "block", color: "#9ca3af", fontSize: 12, marginBottom: 5 }}>
                  Access level
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  style={{ ...input, cursor: "pointer" }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="tester">Tester</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting}
                style={{
                  padding: "9px 18px",
                  background: "#6366f1",
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: inviting ? "not-allowed" : "pointer",
                  opacity: inviting ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </div>
            {inviteError && (
              <p style={{ color: "#fca5a5", fontSize: 13, margin: "10px 0 0" }}>{inviteError}</p>
            )}
            {inviteSuccess && (
              <p style={{ color: "#4ade80", fontSize: 13, margin: "10px 0 0" }}>✓ {inviteSuccess}</p>
            )}
          </form>
        </div>
      )}

      {/* Role legend */}
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { role: "admin", desc: "Full access + user management" },
          { role: "viewer", desc: "Full dashboard access, no management" },
          { role: "tester", desc: "Placeholder data only, no 2FA required" },
        ].map(({ role, desc }) => (
          <div key={role} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge label={role} {...ROLE_COLORS[role]} />
            <span style={{ color: "#6b7280", fontSize: 12 }}>{desc}</span>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {error && (
          <div style={{ padding: 20, color: "#fca5a5", fontSize: 13 }}>{error}</div>
        )}
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading users…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                {["User", "Role", "2FA", "Status", "Last sign in", "Joined", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      color: "#6b7280",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: i < users.length - 1 ? "1px solid #1a1a24" : "none",
                    opacity: user.is_active ? 1 : 0.5,
                  }}
                >
                  {/* User */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: ROLE_COLORS[user.role]?.bg ?? "#1e1e2e",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: ROLE_COLORS[user.role]?.text ?? "#9ca3af",
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {(user.full_name || user.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, color: "#f0f0ff", fontSize: 13, fontWeight: 500 }}>
                          {user.full_name || "—"}
                          {user.id === currentUserId && (
                            <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 6 }}>(you)</span>
                          )}
                          {user.invited && (
                            <span style={{ color: "#f59e0b", fontSize: 11, marginLeft: 6 }}>pending invite</span>
                          )}
                        </p>
                        <p style={{ margin: "1px 0 0", color: "#6b7280", fontSize: 12 }}>{user.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td style={{ padding: "14px 16px" }}>
                    <select
                      value={user.role}
                      disabled={user.id === currentUserId}
                      onChange={(e) =>
                        updateUser(user.id, { role: e.target.value as User["role"] })
                      }
                      style={{
                        background: ROLE_COLORS[user.role]?.bg ?? "#1e1e2e",
                        color: ROLE_COLORS[user.role]?.text ?? "#9ca3af",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        cursor: user.id === currentUserId ? "not-allowed" : "pointer",
                        outline: "none",
                      }}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="tester">Tester</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  {/* 2FA */}
                  <td style={{ padding: "14px 16px" }}>
                    {user.role === "tester" ? (
                      <span style={{ color: "#4b5563", fontSize: 12 }}>N/A</span>
                    ) : user.mfa_enabled ? (
                      <Badge label="Enabled" bg="#1a2e1a" text="#4ade80" />
                    ) : (
                      <Badge label="Not set" bg="#2d2416" text="#fbbf24" />
                    )}
                  </td>

                  {/* Status */}
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      onClick={() =>
                        user.id !== currentUserId &&
                        updateUser(user.id, { is_active: !user.is_active })
                      }
                      disabled={user.id === currentUserId}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: user.id === currentUserId ? "default" : "pointer",
                        padding: 0,
                      }}
                    >
                      {user.is_active ? (
                        <Badge label="Active" bg="#1a2e1a" text="#4ade80" />
                      ) : (
                        <Badge label="Inactive" bg="#1e1e2e" text="#6b7280" />
                      )}
                    </button>
                  </td>

                  {/* Last sign in */}
                  <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 12, whiteSpace: "nowrap" }}>
                    {fmt(user.last_sign_in)}
                  </td>

                  {/* Joined */}
                  <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 12, whiteSpace: "nowrap" }}>
                    {fmt(user.created_at)}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "14px 16px" }}>
                    {user.id !== currentUserId && (
                      <button
                        onClick={() => deleteUser(user.id, user.email)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#6b7280",
                          cursor: "pointer",
                          fontSize: 12,
                          padding: "4px 8px",
                          borderRadius: 6,
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
                        title="Remove user"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Access level guide */}
      <div style={{ ...card, background: "#0d0d14" }}>
        <p style={{ color: "#4b5563", fontSize: 12, margin: 0, lineHeight: "1.6" }}>
          <strong style={{ color: "#6b7280" }}>Admin</strong> — full dashboard access, user management, all integrations and settings. Requires 2FA.
          {" · "}
          <strong style={{ color: "#6b7280" }}>Viewer</strong> — read-only access to all real dashboard data. Requires 2FA.
          {" · "}
          <strong style={{ color: "#6b7280" }}>Tester</strong> — sees placeholder data only. No 2FA required. Use for demos and walkthroughs.
        </p>
      </div>
    </div>
  );
}
