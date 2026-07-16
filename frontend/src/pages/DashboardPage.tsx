import React, { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { StatCardSkeleton, TableRowSkeleton, Skeleton } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api/client";
import {
  Wallet, CreditCard,
  TrendingUp, ArrowUpRight, ArrowDownLeft, Plus,
} from "lucide-react";

interface Account {
  id: string; accountNumber: string; accountType: string;
  balance: number; currency: string; status: string;
}
interface Transaction {
  id: string; amount: number; currency: string;
  transactionType: string; status: string; createdAt: string;
  sourceAccount?: { accountNumber: string };
  destinationAccount?: { accountNumber: string };
}

// ── Mini Spending Chart (no library needed) ──────────────────────────────────
const SpendingChart = ({ transactions }: { transactions: Transaction[] }) => {
  // Group spending by day for last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const data = days.map(day => {
    const label = day.toLocaleDateString("en-US", { weekday: "short" });
    const spent = transactions
      .filter(tx => {
        const txDate = new Date(tx.createdAt);
        return (
          txDate.toDateString() === day.toDateString() &&
          tx.transactionType !== "deposit" &&
          tx.status === "completed"
        );
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const received = transactions
      .filter(tx => {
        const txDate = new Date(tx.createdAt);
        return (
          txDate.toDateString() === day.toDateString() &&
          tx.transactionType === "deposit" &&
          tx.status === "completed"
        );
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    return { label, spent, received };
  });

  const maxVal = Math.max(...data.flatMap(d => [d.spent, d.received]), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "#3b82f6" }} /> Money Out
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }} /> Money In
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 100 }}>
        {data.map(({ label, spent, received }) => {
          const spentH = spent ? Math.max((spent / maxVal) * 90, 4) : 0;
          const recvH  = received ? Math.max((received / maxVal) * 90, 4) : 0;
          return (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 90 }}>
                <div
                  title={`Out: $${spent.toLocaleString()}`}
                  style={{
                    width: 10, height: spentH || 3,
                    background: spentH ? "linear-gradient(to top, #2563eb, #3b82f6)" : "#1e2d45",
                    borderRadius: "3px 3px 0 0",
                    transition: "height 0.4s ease",
                    cursor: spent ? "pointer" : "default",
                  }}
                />
                <div
                  title={`In: $${received.toLocaleString()}`}
                  style={{
                    width: 10, height: recvH || 3,
                    background: recvH ? "linear-gradient(to top, #059669, #10b981)" : "#1e2d45",
                    borderRadius: "3px 3px 0 0",
                    transition: "height 0.4s ease",
                    cursor: received ? "pointer" : "default",
                  }}
                />
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────

export const DashboardPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [accRes, txRes] = await Promise.all([
          api.get("/accounts"),
          api.get("/transactions?limit=10"),
        ]);
        setAccounts(accRes.data.data.accounts);
        setTransactions(txRes.data.data.transactions);
      } catch {
        toast.error("Failed to load dashboard data. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const totalIn  = transactions.filter(t => t.transactionType === "deposit" && t.status === "completed").reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = transactions.filter(t => t.transactionType !== "deposit" && t.status === "completed").reduce((s, t) => s + Number(t.amount), 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const statCards = [
    { label: "Total Balance", value: `$${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: <Wallet size={20} color="#3b82f6" />, bg: "rgba(59,130,246,0.15)" },
    { label: "Active Accounts", value: accounts.length, icon: <TrendingUp size={20} color="#10b981" />, bg: "rgba(16,185,129,0.15)" },
    { label: "Money In (recent)", value: `+$${totalIn.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: <ArrowDownLeft size={20} color="#10b981" />, bg: "rgba(16,185,129,0.15)" },
    { label: "Money Out (recent)", value: `-$${totalOut.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: <ArrowUpRight size={20} color="#ef4444" />, bg: "rgba(239,68,68,0.12)" },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        {/* Header */}
        <div className="page-header">
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>{greeting} 👋</p>
          <h1 className="page-title">
            Welcome back, <span className="gradient-text">{user?.firstName}</span>
          </h1>
        </div>

        {/* Stat Cards */}
        <div className="grid-4" style={{ marginBottom: 28 }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            : statCards.map(({ label, value, icon, bg }) => (
              <div key={label} className="stat-card">
                <div className="stat-icon" style={{ background: bg }}>{icon}</div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))
          }
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>

          {/* LEFT column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Spending Chart */}
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>7-Day Activity</h2>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Last 7 days</span>
              </div>
              {loading
                ? <Skeleton height={120} borderRadius={10} />
                : <SpendingChart transactions={transactions} />
              }
            </div>

            {/* Recent Transactions */}
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Transactions</h2>
                <a href="/transactions" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
                  View all →
                </a>
              </div>

              {loading ? (
                <table className="data-table">
                  <tbody>{Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />)}</tbody>
                </table>
              ) : transactions.length === 0 ? (
                <div className="empty-state">
                  <ArrowLeftRight size={40} />
                  <p>No transactions yet — make your first deposit!</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 6).map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: tx.transactionType === "deposit" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.1)",
                              display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                              {tx.transactionType === "deposit"
                                ? <ArrowDownLeft size={14} color="var(--success)" />
                                : <ArrowUpRight size={14} color="var(--danger)" />}
                            </div>
                            <span style={{ textTransform: "capitalize", fontSize: 13 }}>{tx.transactionType}</span>
                          </div>
                        </td>
                        <td>
                          <span className={tx.transactionType === "deposit" ? "tx-credit" : "tx-debit"} style={{ fontWeight: 600 }}>
                            {tx.transactionType === "deposit" ? "+" : "-"}{tx.currency} {Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${tx.status === "completed" ? "badge-success" : tx.status === "failed" ? "badge-danger" : "badge-warning"}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                          {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* RIGHT column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* My Accounts */}
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>My Accounts</h2>
                <a href="/accounts" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>
                  <Plus size={16} />
                </a>
              </div>

              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1, 2].map(i => (
                    <div key={i} style={{ padding: "14px 16px", background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <Skeleton width={60} height={12} borderRadius={6} />
                        <Skeleton width={50} height={18} borderRadius={20} />
                      </div>
                      <Skeleton width="70%" height={22} borderRadius={6} />
                      <Skeleton width="50%" height={11} borderRadius={6} style={{ marginTop: 8 }} />
                    </div>
                  ))}
                </div>
              ) : accounts.length === 0 ? (
                <div className="empty-state" style={{ padding: "30px 0" }}>
                  <Wallet size={32} />
                  <p style={{ fontSize: 13 }}>No accounts found</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {accounts.map((acc) => (
                    <div key={acc.id} style={{
                      padding: "14px 16px",
                      background: "var(--bg-secondary)",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      transition: "border-color 0.15s",
                      cursor: "pointer",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-light)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "capitalize" }}>{acc.accountType}</span>
                        <span className={`badge ${acc.status === "active" ? "badge-success" : "badge-warning"}`}>{acc.status}</span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        ${Number(acc.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, letterSpacing: 1 }}>{acc.accountNumber}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="glass-card" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Quick Actions</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { href: "/transactions", icon: <ArrowUpRight size={15} />, label: "Send Money" },
                  { href: "/accounts",     icon: <Plus size={15} />,          label: "New Account" },
                  { href: "/cards",        icon: <CreditCard size={15} />,    label: "Manage Cards" },
                  { href: "/profile",      icon: <Wallet size={15} />,        label: "View Profile" },
                ].map(({ href, icon, label }) => (
                  <a key={href} href={href} className="btn-ghost" style={{
                    textDecoration: "none", display: "flex", alignItems: "center",
                    gap: 8, padding: "10px 14px", justifyContent: "flex-start",
                  }}>
                    {icon} {label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Inline fallback icon
const ArrowLeftRight = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);
