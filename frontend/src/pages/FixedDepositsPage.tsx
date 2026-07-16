import React, { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { useToast } from "../context/ToastContext";
import api from "../api/client";
import { Plus, Clock, Lock, Unlock, Percent } from "lucide-react";
import { TableRowSkeleton } from "../components/Skeleton";

interface FixedDeposit {
  id: string;
  principalAmount: string;
  interestRate: string;
  maturityAmount: string;
  maturityDate: string;
  status: string;
  createdAt: string;
}

export const FixedDepositsPage = () => {
  const toast = useToast();
  const [fds, setFds] = useState<FixedDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);

  // Open FD Form State
  const [principalAmount, setPrincipalAmount] = useState("");
  const [termMonths, setTermMonths] = useState("12");
  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; accountNumber: string; balance: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadFds = async () => {
    try {
      const res = await api.get("/fds");
      setFds(res.data.data.fds);
    } catch {
      toast.error("Failed to load fixed deposits.");
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get("/accounts");
      setAccounts(res.data.data.accounts);
    } catch {
      toast.error("Failed to load accounts.");
    }
  };

  useEffect(() => {
    loadFds();
    loadAccounts();
  }, []);

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/fds", {
        principalAmount: Number(principalAmount),
        termMonths: Number(termMonths),
        linkedAccountId,
      });
      toast.success("Fixed Deposit opened successfully!");
      setShowOpen(false);
      setPrincipalAmount("");
      loadFds();
      loadAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to open FD.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (id: string) => {
    if (!window.confirm("Are you sure you want to close this FD? Premature closing means you will only receive your principal back, without interest.")) {
      return;
    }
    try {
      const res = await api.post(`/fds/${id}/close`);
      toast.success(`FD Closed. $${res.data.data.payoutAmount} credited to your account.`);
      loadFds();
      loadAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to close FD.");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <Lock size={16} color="var(--accent)" />;
      case "matured": return <Unlock size={16} color="var(--success)" />;
      case "prematurely_closed": return <Unlock size={16} color="var(--warning)" />;
      default: return <Clock size={16} color="var(--text-muted)" />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title">Fixed Deposits</h1>
            <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Grow your savings with fixed returns.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowOpen(true)} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Plus size={18} /> Open FD
          </button>
        </div>

        {/* Open FD Modal */}
        {showOpen && (
          <div className="modal-overlay" onClick={() => setShowOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2 style={{ marginBottom: 20 }}>Open a Fixed Deposit</h2>
              <form onSubmit={handleOpen} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="form-label">Funding Account</label>
                  <select className="form-input" value={linkedAccountId} onChange={e => setLinkedAccountId(e.target.value)} required>
                    <option value="">Select account...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountNumber} - Bal: ${Number(acc.balance).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Deposit Amount ($)</label>
                  <input type="number" className="form-input" value={principalAmount} onChange={e => setPrincipalAmount(e.target.value)} required min="500" />
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Minimum $500.</p>
                </div>
                <div>
                  <label className="form-label">Term Duration</label>
                  <select className="form-input" value={termMonths} onChange={e => setTermMonths(e.target.value)} required>
                    <option value="6">6 Months @ 7% APR</option>
                    <option value="12">12 Months @ 7% APR</option>
                    <option value="24">24 Months @ 7% APR</option>
                    <option value="60">5 Years @ 7% APR</option>
                  </select>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 10 }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? "Opening..." : "Open FD"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="glass-card" style={{ padding: 24, marginTop: 24 }}>
          {loading ? (
            <table className="data-table">
              <tbody>{Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)}</tbody>
            </table>
          ) : fds.length === 0 ? (
            <div className="empty-state">
              <Percent size={40} />
              <p>You don't have any Fixed Deposits.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Principal</th>
                  <th>Maturity Amount</th>
                  <th>Maturity Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fds.map(fd => (
                  <tr key={fd.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>${Number(fd.principalAmount).toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>@ {fd.interestRate}% APR</div>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--success)" }}>${Number(fd.maturityAmount).toLocaleString()}</td>
                    <td>{new Date(fd.maturityDate).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, textTransform: "capitalize" }}>
                        {getStatusIcon(fd.status)}
                        {fd.status.replace("_", " ")}
                      </div>
                    </td>
                    <td>
                      {fd.status === "active" && (
                        <button className="btn-secondary" onClick={() => handleClose(fd.id)} style={{ padding: "6px 12px", fontSize: 12, color: "var(--danger)", borderColor: "var(--danger)" }}>
                          Close FD
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};
