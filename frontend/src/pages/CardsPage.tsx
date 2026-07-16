import React, { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { CardSkeleton } from "../components/Skeleton";
import { useToast } from "../context/ToastContext";
import api from "../api/client";
import { Plus, Snowflake, ShieldX } from "lucide-react";

interface Card {
  id: string; cardNumberHash: string; cardType: string;
  status: string; expiryDate: string; dailyLimit: number;
  account: { accountNumber: string; accountType: string; currency: string };
}
interface Account { id: string; accountNumber: string; accountType: string; }

export const CardsPage = () => {
  const toast = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState("");
  const [form, setForm] = useState({ accountId: "", cardType: "debit", dailyLimit: "1000" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [cRes, aRes] = await Promise.all([api.get("/cards"), api.get("/accounts")]);
      setCards(cRes.data.data.cards);
      setAccounts(aRes.data.data.accounts);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleIssue = async () => {
    setSubmitting(true); setError("");
    try {
      await api.post("/cards", { ...form, dailyLimit: Number(form.dailyLimit) });
      toast.success("Card issued successfully!");
      setShowModal(false);
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to issue card.");
    } finally { setSubmitting(false); }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/cards/${id}/status`, { status });
      toast.success(status === "frozen" ? "Card frozen." : status === "active" ? "Card unfrozen." : "Card permanently blocked.");
      load();
    } catch (e: any) { toast.error(e.response?.data?.message || "Failed."); }
  };

  const handleLimit = async (id: string) => {
    try {
      await api.patch(`/cards/${id}/limits`, { dailyLimit: Number(newLimit) });
      toast.success(`Daily limit updated to $${Number(newLimit).toLocaleString()}`);
      setShowLimitModal(null);
      setNewLimit("");
      load();
    } catch (e: any) { toast.error(e.response?.data?.message || "Failed."); }
  };

  const statusColor: Record<string, string> = {
    active: "var(--success)", frozen: "#818cf8", blocked: "var(--danger)"
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title">Cards</h1>
            <p className="page-subtitle">Manage your debit and credit cards</p>
          </div>
          <button className="btn-primary" onClick={() => { setShowModal(true); setError(""); }}
            style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={15} /> Issue Card
          </button>
        </div>

        {/* Toast handles success messages */}

        {loading ? (
          <div className="grid-3">
            {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : cards.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
            <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>No cards yet</p>
            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => setShowModal(true)}>
              Issue your first card
            </button>
          </div>
        ) : (
          <div className="grid-3">
            {cards.map((card) => (
              <div key={card.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Visual Bank Card */}
                <div className="bank-card" style={{
                  opacity: card.status === "blocked" ? 0.5 : 1,
                  filter: card.status === "frozen" ? "grayscale(40%)" : "none",
                }}>
                  <div className="card-chip" />
                  <div className="card-number">{card.cardNumberHash}</div>
                  <div className="card-info">
                    <div className="card-holder">
                      <span>Account</span>
                      <strong>{card.account.accountType}</strong>
                    </div>
                    <div className="card-expiry">
                      <span>Expires</span>
                      <strong>{new Date(card.expiryDate).toLocaleDateString("en-US", { month: "2-digit", year: "2-digit" })}</strong>
                    </div>
                    <div className="card-type-logo">
                      {card.cardType === "debit" ? "DB" : "CC"}
                    </div>
                  </div>

                  {/* Status overlay */}
                  {card.status !== "active" && (
                    <div style={{
                      position: "absolute", top: 16, right: 16,
                      background: statusColor[card.status],
                      color: "white", padding: "3px 10px",
                      borderRadius: 20, fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: 1,
                    }}>
                      {card.status}
                    </div>
                  )}
                </div>

                {/* Card Info + Actions */}
                <div className="glass-card" style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Daily Limit</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        ${Number(card.dailyLimit).toLocaleString()}
                      </div>
                    </div>
                    <span className={`badge ${card.status === "active" ? "badge-success" : card.status === "frozen" ? "badge-info" : "badge-danger"}`}>
                      {card.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
                    {card.account.accountNumber} · {card.cardType} card
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {card.status === "active" && (
                      <>
                        <button className="btn-ghost" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                          onClick={() => handleStatus(card.id, "frozen")}>
                          <Snowflake size={13} /> Freeze Card
                        </button>
                        <button className="btn-ghost" style={{ fontSize: 12 }}
                          onClick={() => { setShowLimitModal(card.id); setNewLimit(String(card.dailyLimit)); }}>
                          Edit Daily Limit
                        </button>
                      </>
                    )}
                    {card.status === "frozen" && (
                      <button className="btn-primary" style={{ fontSize: 12 }}
                        onClick={() => handleStatus(card.id, "active")}>
                        Unfreeze Card
                      </button>
                    )}
                    {card.status !== "blocked" && (
                      <button className="btn-danger" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                        onClick={() => {
                          if (window.confirm("Permanently block this card? This cannot be undone.")) {
                            handleStatus(card.id, "blocked");
                          }
                        }}>
                        <ShieldX size={13} /> Block Card
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Issue Card Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Issue New Card</h2>
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Link to Account</label>
                  <select className="form-input" value={form.accountId}
                    onChange={e => setForm({ ...form, accountId: e.target.value })}>
                    <option value="">Select account</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.accountType} — {a.accountNumber}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Card Type</label>
                  <select className="form-input" value={form.cardType}
                    onChange={e => setForm({ ...form, cardType: e.target.value })}>
                    <option value="debit">Debit Card</option>
                    <option value="credit">Credit Card</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Daily Spending Limit ($)</label>
                  <input className="form-input" type="number" min="100" max="100000"
                    value={form.dailyLimit}
                    onChange={e => setForm({ ...form, dailyLimit: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleIssue} disabled={submitting}>
                  {submitting ? <span className="spinner" /> : "Issue Card"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Update Limit Modal */}
        {showLimitModal && (
          <div className="modal-overlay" onClick={() => setShowLimitModal(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Update Daily Limit</h2>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">New Daily Limit ($)</label>
                <input className="form-input" type="number" min="100" max="100000"
                  value={newLimit} onChange={e => setNewLimit(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowLimitModal(null)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleLimit(showLimitModal)}>
                  Update Limit
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
