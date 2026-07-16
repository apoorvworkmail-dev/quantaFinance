import React, { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { AccountCardSkeleton } from "../components/Skeleton";
import { useToast } from "../context/ToastContext";
import api from "../api/client";
import { Plus, Wallet, Snowflake, X } from "lucide-react";

interface Account {
  id: string; accountNumber: string; accountType: string;
  balance: number; currency: string; status: string; createdAt: string;
}

export const AccountsPage = () => {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newType, setNewType] = useState("savings");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await api.get("/accounts");
      setAccounts(res.data.data.accounts);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleOpen = async () => {
    setCreating(true); setError("");
    try {
      await api.post("/accounts", { accountType: newType, currency: "USD" });
      toast.success(`${newType} account opened successfully!`);
      setShowModal(false);
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to open account.");
    } finally { setCreating(false); }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/accounts/${id}/status`, { status });
      toast.success(status === "frozen" ? "Account frozen." : status === "active" ? "Account unfrozen." : "Account closed.");
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Action failed.");
    }
  };

  const typeColor: Record<string, string> = {
    checking: "#3b82f6",
    savings: "#10b981",
    loan: "#f59e0b",
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title">Accounts</h1>
            <p className="page-subtitle">Manage all your bank accounts</p>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Open Account
          </button>
        </div>

        {/* Remove old success alert, toast handles it */}

        {loading ? (
          <div className="grid-3">
            {[1, 2, 3].map(i => <AccountCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid-3">
            {accounts.map((acc) => (
              <div key={acc.id} className="glass-card" style={{ padding: 24 }}>
                {/* Account Type Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div style={{
                    background: `${typeColor[acc.accountType]}20`,
                    color: typeColor[acc.accountType],
                    padding: "4px 12px", borderRadius: 20,
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                  }}>
                    {acc.accountType}
                  </div>
                  <span className={`badge ${acc.status === "active" ? "badge-success" : acc.status === "frozen" ? "badge-info" : "badge-danger"}`}>
                    {acc.status}
                  </span>
                </div>

                {/* Balance */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Available Balance</div>
                  <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1px" }}>
                    ${Number(acc.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, letterSpacing: 2 }}>
                    {acc.accountNumber}
                  </div>
                </div>

                <div className="divider" />

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  {acc.status === "active" ? (
                    <button className="btn-ghost" style={{ flex: 1, fontSize: 12, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => handleStatus(acc.id, "frozen")}>
                      <Snowflake size={13} /> Freeze
                    </button>
                  ) : acc.status === "frozen" ? (
                    <button className="btn-primary" style={{ flex: 1, fontSize: 12, padding: "8px 12px" }}
                      onClick={() => handleStatus(acc.id, "active")}>
                      Unfreeze
                    </button>
                  ) : null}

                  {acc.status !== "closed" && (
                    <button className="btn-danger" style={{ fontSize: 12, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => {
                        if (window.confirm("Close this account? This cannot be undone.")) {
                          handleStatus(acc.id, "closed");
                        }
                      }}>
                      <X size={13} /> Close
                    </button>
                  )}
                </div>

                <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
                  Opened {new Date(acc.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </div>
              </div>
            ))}

            {/* Add account card */}
            <div
              onClick={() => setShowModal(true)}
              style={{
                border: "2px dashed var(--border)",
                borderRadius: 16, padding: 24,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", gap: 12,
                transition: "border-color 0.2s",
                minHeight: 220,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "var(--accent-glow)", border: "1px solid rgba(59,130,246,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Plus size={22} color="var(--accent)" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Open New Account</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Savings, Checking, or Loan</div>
              </div>
            </div>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Open New Account</h2>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Account Type</label>
                <select className="form-input" value={newType} onChange={e => setNewType(e.target.value)}>
                  <option value="savings">Savings</option>
                  <option value="checking">Checking</option>
                  <option value="loan">Loan</option>
                </select>
              </div>

              <div style={{
                background: "var(--bg-secondary)", borderRadius: 10,
                padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)",
                marginBottom: 20
              }}>
                <Wallet size={14} style={{ display: "inline", marginRight: 6 }} />
                Account will be opened with <strong style={{ color: "var(--text-primary)" }}>$0.00</strong> starting balance in USD.
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleOpen} disabled={creating}>
                  {creating ? <span className="spinner" /> : "Open Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
