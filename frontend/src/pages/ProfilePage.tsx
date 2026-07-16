import React, { useEffect, useState, useRef } from "react";
import { Sidebar } from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api/client";
import {
  ShieldCheck,
  Wallet, CreditCard, Activity, Edit2, Save, X, Camera,
} from "lucide-react";

interface FullProfile {
  id: string; firstName: string; lastName: string;
  email: string; phoneNumber: string | null;
  profilePic: string | null;
  role: string; status: string; createdAt: string;
  accounts: { id: string; accountNumber: string; accountType: string; balance: number; currency: string; status: string; ifscCode: string; branch: string }[];
}

export const ProfilePage = () => {
  const { user, login } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get("/auth/me");
      const u = res.data.data.user;
      setProfile(u);
      setEditPhone(u.phoneNumber || "");
      setEditFirstName(u.firstName);
      setEditLastName(u.lastName);
    } catch {
      toast.error("Failed to load profile details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const res = await api.put("/auth/me", {
        phoneNumber: editPhone,
        firstName: editFirstName,
        lastName: editLastName,
      });
      setProfile(prev => prev ? { ...prev, ...res.data.data.user } : null);
      toast.success("Profile updated successfully!");
      setEditMode(false);
    } catch {
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await api.post("/auth/upload-avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const newPic = res.data.data.profilePic;
      setProfile(prev => prev ? { ...prev, profilePic: newPic } : null);
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Avatar upload failed.");
    }
  };

  const totalBalance = profile?.accounts?.reduce((sum, a) => sum + Number(a.balance), 0) ?? 0;
  const initials = `${profile?.firstName?.[0] ?? ""}${profile?.lastName?.[0] ?? ""}`;

  const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
    admin: { label: "Administrator", color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
    teller: { label: "Bank Teller", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
    customer: { label: "Customer", color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  };
  const roleInfo = roleConfig[profile?.role ?? "customer"] || roleConfig.customer;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header">
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your personal information and preferences</p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}><span className="spinner" /></div>
        ) : profile ? (
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}>

            {/* ── LEFT: Profile Card ──────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Avatar + Name */}
              <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
                <div style={{ position: "relative", width: 90, height: 90, margin: "0 auto 16px" }}>
                  {profile.profilePic ? (
                    <img src={`http://localhost:5000${profile.profilePic}`} alt="Profile Avatar" style={{
                      width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover",
                      boxShadow: "0 0 30px rgba(59,130,246,0.3)", border: "2px solid var(--accent)",
                    }} />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%",
                      background: "linear-gradient(135deg, #3b82f6, #818cf8)",
                      borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 32, fontWeight: 800, color: "white",
                      boxShadow: "0 0 30px rgba(59,130,246,0.4)",
                    }}>
                      {initials}
                    </div>
                  )}
                  <button onClick={handleAvatarClick} style={{
                    position: "absolute", bottom: -2, right: -2,
                    background: "var(--accent)", border: "none", width: 28, height: 28, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    color: "white", boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                  }}>
                    <Camera size={14} />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} accept="image/*" />
                </div>

                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.3px" }}>
                  {profile.firstName} {profile.lastName}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  {profile.email}
                </div>

                <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center" }}>
                  <span style={{
                    padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: roleInfo.bg, color: roleInfo.color,
                  }}>
                    {roleInfo.label}
                  </span>
                  <span className={`badge ${profile.status === "verified" ? "badge-success" : profile.status === "active" ? "badge-info" : "badge-danger"}`}>
                    {profile.status === "verified" ? "Verified User" : profile.status}
                  </span>
                </div>

                <div style={{ marginTop: 20, fontSize: 12, color: "var(--text-muted)" }}>
                  Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  Account Summary
                </div>
                {[
                  { icon: <Wallet size={16} color="var(--accent)" />, label: "Total Balance", value: `$${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "var(--accent)" },
                  { icon: <Wallet size={16} color="var(--success)" />, label: "Accounts", value: profile.accounts.length, color: "var(--success)" },
                ].map(({ icon, label, value, color }) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 0", borderBottom: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{icon}</div>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{value}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ShieldCheck size={16} color="var(--gold)" />
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Account ID</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {profile.id.slice(0, 8)}...
                  </span>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Details ──────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Personal Info */}
              <div className="glass-card" style={{ padding: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700 }}>Personal Information</h2>
                  {!editMode ? (
                    <button className="btn-ghost" style={{ fontSize: 13, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => setEditMode(true)}>
                      <Edit2 size={13} /> Edit
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn-ghost" style={{ fontSize: 13, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}
                        onClick={() => { setEditMode(false); setEditPhone(profile.phoneNumber || ""); }}>
                        <X size={13} /> Cancel
                      </button>
                      <button className="btn-primary" style={{ fontSize: 13, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}
                        onClick={handleUpdate}
                        disabled={saving}>
                        {saving ? <span className="spinner" /> : <><Save size={13} /> Save</>}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid-2" style={{ gap: 20 }}>
                  <div>
                    <label className="form-label">First Name</label>
                    {editMode ? (
                      <input className="form-input" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 500, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)" }}>
                        {profile.firstName}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="form-label">Last Name</label>
                    {editMode ? (
                      <input className="form-input" value={editLastName} onChange={e => setEditLastName(e.target.value)} />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 500, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)" }}>
                        {profile.lastName}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="form-label">Email Address</label>
                    <div style={{ fontSize: 14, fontWeight: 500, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)", opacity: 0.7 }}>
                      {profile.email}
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Phone Number</label>
                    {editMode ? (
                      <input className="form-input" type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 500, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)" }}>
                        {profile.phoneNumber || <span style={{ color: "var(--text-muted)" }}>Not set</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Linked Accounts */}
              <div className="glass-card" style={{ padding: 28 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Linked Bank Accounts</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {profile.accounts.map((acc) => {
                    const typeColors: Record<string, string> = { checking: "#3b82f6", savings: "#10b981", salary: "#a855f7", loan: "#f59e0b" };
                    const c = typeColors[acc.accountType] || "#818cf8";
                    return (
                      <div key={acc.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "14px 18px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: `${c}20`, display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Wallet size={18} color={c} />
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{acc.accountType} Account</span>
                              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{acc.branch}</span>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>
                              {acc.accountNumber} · IFSC: {acc.ifscCode}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>
                            ${Number(acc.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </div>
                          <span className={`badge ${acc.status === "active" ? "badge-success" : acc.status === "frozen" ? "badge-info" : "badge-danger"}`}>
                            {acc.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Security Info */}
              <div className="glass-card" style={{ padding: 28 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Security & Access</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    { icon: <ShieldCheck size={16} color="var(--success)" />, label: "Password", value: "••••••••••••", sub: "Hashed with bcrypt (10 rounds)" },
                    { icon: <Activity size={16} color="var(--accent)" />, label: "All actions are audit logged", value: "", sub: "Login attempts, transfers & changes are recorded" },
                    { icon: <CreditCard size={16} color="var(--gold)" />, label: "Session Tokens", value: "", sub: "JWT Access & Refresh Tokens used" },
                  ].map(({ icon, label, value, sub }) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 16px", background: "var(--bg-secondary)",
                      borderRadius: 10, border: "1px solid var(--border)",
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>{icon}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{label} {value && <span style={{ color: "var(--text-muted)" }}>{value}</span>}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};
