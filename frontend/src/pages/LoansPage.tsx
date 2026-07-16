import React, { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { useToast } from "../context/ToastContext";
import api from "../api/client";
import { Plus, CheckCircle, Clock, XCircle, CreditCard, DollarSign } from "lucide-react";
import { TableRowSkeleton } from "../components/Skeleton";

interface Loan {
  id: string;
  loanType: string;
  principalAmount: string;
  interestRate: string;
  remainingBalance: string;
  termMonths: number;
  status: string;
  createdAt: string;
}

export const LoansPage = () => {
  const toast = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);

  // Apply Form State
  const [loanType, setLoanType] = useState("personal");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [termMonths, setTermMonths] = useState("12");
  const [submitting, setSubmitting] = useState(false);

  // Pay Loan Form State
  const [selectedLoanToPay, setSelectedLoanToPay] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; accountNumber: string; balance: string }[]>([]);

  const loadLoans = async () => {
    try {
      const res = await api.get("/loans");
      setLoans(res.data.data.loans);
    } catch {
      toast.error("Failed to load loans.");
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get("/accounts");
      setAccounts(res.data.data.accounts);
    } catch {
      toast.error("Failed to load accounts for payment.");
    }
  };

  useEffect(() => {
    loadLoans();
    loadAccounts();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/loans", {
        loanType,
        principalAmount: Number(principalAmount),
        termMonths: Number(termMonths),
      });
      toast.success("Loan application submitted successfully!");
      setShowApply(false);
      setPrincipalAmount("");
      loadLoans();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to apply for loan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanToPay) return;
    try {
      await api.post(`/loans/${selectedLoanToPay}/pay`, {
        amount: Number(payAmount),
        sourceAccountId,
      });
      toast.success("Loan payment successful!");
      setSelectedLoanToPay(null);
      setPayAmount("");
      loadLoans();
      loadAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to make loan payment.");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle size={16} color="var(--success)" />;
      case "pending": return <Clock size={16} color="var(--warning)" />;
      case "paid_off": return <CheckCircle size={16} color="var(--accent)" />;
      default: return <XCircle size={16} color="var(--danger)" />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title">My Loans</h1>
            <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Manage your active loans and apply for new ones.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowApply(true)} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Plus size={18} /> Apply for Loan
          </button>
        </div>

        {/* Apply Modal */}
        {showApply && (
          <div className="modal-overlay" onClick={() => setShowApply(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2 style={{ marginBottom: 20 }}>Apply for a Loan</h2>
              <form onSubmit={handleApply} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="form-label">Loan Type</label>
                  <select className="form-input" value={loanType} onChange={e => setLoanType(e.target.value)} required>
                    <option value="personal">Personal Loan</option>
                    <option value="home">Home Loan</option>
                    <option value="auto">Auto Loan</option>
                    <option value="education">Education Loan</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Principal Amount ($)</label>
                  <input type="number" className="form-input" value={principalAmount} onChange={e => setPrincipalAmount(e.target.value)} required min="100" />
                </div>
                <div>
                  <label className="form-label">Term Duration</label>
                  <select className="form-input" value={termMonths} onChange={e => setTermMonths(e.target.value)} required>
                    <option value="12">12 Months</option>
                    <option value="24">24 Months</option>
                    <option value="36">36 Months</option>
                    <option value="48">48 Months</option>
                    <option value="60">60 Months</option>
                  </select>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 10 }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowApply(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? "Submitting..." : "Apply"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Pay Modal */}
        {selectedLoanToPay && (
          <div className="modal-overlay" onClick={() => setSelectedLoanToPay(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2 style={{ marginBottom: 20 }}>Make Loan Payment</h2>
              <form onSubmit={handlePay} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="form-label">Source Account</label>
                  <select className="form-input" value={sourceAccountId} onChange={e => setSourceAccountId(e.target.value)} required>
                    <option value="">Select account...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountNumber} - Bal: ${Number(acc.balance).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Payment Amount ($)</label>
                  <input type="number" className="form-input" value={payAmount} onChange={e => setPayAmount(e.target.value)} required min="1" step="0.01" />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 10 }}>
                  <button type="button" className="btn-secondary" onClick={() => setSelectedLoanToPay(null)}>Cancel</button>
                  <button type="submit" className="btn-primary">Pay Now</button>
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
          ) : loans.length === 0 ? (
            <div className="empty-state">
              <DollarSign size={40} />
              <p>You don't have any loans.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Loan Details</th>
                  <th>Original Amount</th>
                  <th>Remaining Bal</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map(loan => (
                  <tr key={loan.id}>
                    <td>
                      <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{loan.loanType} Loan</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{loan.termMonths} Months @ {loan.interestRate}%</div>
                    </td>
                    <td>${Number(loan.principalAmount).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>${Number(loan.remainingBalance).toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, textTransform: "capitalize" }}>
                        {getStatusIcon(loan.status)}
                        {loan.status.replace("_", " ")}
                      </div>
                    </td>
                    <td>
                      {loan.status === "active" && (
                        <button className="btn-secondary" onClick={() => setSelectedLoanToPay(loan.id)} style={{ padding: "6px 12px", fontSize: 12 }}>
                          Pay
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
