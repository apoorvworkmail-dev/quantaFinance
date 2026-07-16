import React, { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { useToast } from "../context/ToastContext";
import api from "../api/client";
import {
  Users, Wallet, CreditCard,
  ShieldCheck, Search, Ban, CheckCircle,
  TrendingUp, AlertTriangle, Activity, X, RotateCcw,
  Trash2,
} from "lucide-react";

interface Stats {
  users: { total: number; active: number; suspended: number };
  accounts: { total: number; frozen: number };
  transactions: { total: number; completed: number; failed: number; totalVolume: number };
  cards: { total: number; frozen: number; blocked: number };
  recentTransactions: any[];
}

interface User {
  id: string; firstName: string; lastName: string;
  email: string; role: string; status: string; createdAt: string;
  _count: { accounts: number };
}

interface AuditLog {
  id: string; action: string; ipAddress: string;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string; role: string };
}

type Tab = "overview" | "users" | "transactions" | "audit" | "loans";

export const AdminPage = () => {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("");

  // Selected details modal
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userAccounts, setUserAccounts] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const loadStats = async () => {
    const res = await api.get("/admin/stats");
    setStats(res.data.data);
  };

  const loadUsers = async () => {
    const params: any = {};
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    if (statusFilter) params.status = statusFilter;
    const res = await api.get("/admin/users", { params });
    setUsers(res.data.data.users);
  };

  const loadTransactions = async () => {
    const params: any = {};
    if (txTypeFilter) params.type = txTypeFilter;
    const res = await api.get("/admin/transactions", { params });
    setTransactions(res.data.data.transactions);
  };

  const loadAuditLogs = async () => {
    const res = await api.get("/admin/audit-logs");
    setAuditLogs(res.data.data.logs);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await loadStats();
      if (tab === "users") await loadUsers();
      else if (tab === "transactions") await loadTransactions();
      else if (tab === "audit") await loadAuditLogs();
      else if (tab === "loans") await loadLoans();
    } catch {
      toast.error("Failed to load admin dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [tab]);

  useEffect(() => {
    if (tab === "users") loadUsers();
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    if (tab === "transactions") loadTransactions();
  }, [txTypeFilter]);

  // Actions
  const handleUserStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/admin/users/${id}/status`, { status: newStatus });
      toast.success(`User ${newStatus === "suspended" ? "suspended" : "reactivated"} successfully.`);
      loadUsers();
      loadStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to update user status.");
    }
  };

  const handleVerifyKYC = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "verified" ? "pending_kyc" : "verified";
    try {
      await api.patch(`/admin/users/${id}/verify`, { status: nextStatus });
      toast.success(`KYC status updated to ${nextStatus}.`);
      loadUsers();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "KYC update failed.");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Are you absolutely sure you want to permanently delete this user and all their accounts? This cannot be undone.")) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success("User permanently deleted.");
      loadUsers();
      loadStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to delete user.");
    }
  };

  const handleReverseTransaction = async (txId: string) => {
    if (!window.confirm("Reverse this transaction? This will refund the sender and debit the receiver's balance.")) return;
    try {
      await api.post(`/admin/transactions/${txId}/reverse`);
      toast.success("Transaction reversed successfully!");
      loadTransactions();
      loadStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to reverse transaction.");
    }
  };

  const loadLoans = async () => {
    try {
      const res = await api.get("/admin/loans?status=pending");
      setLoans(res.data.data.loans);
    } catch (e: any) {
      toast.error("Failed to load pending loans.");
    }
  };

  const handleApproveRejectLoan = async (id: string, status: "approved" | "rejected") => {
    if (!window.confirm(`Are you sure you want to ${status} this loan?`)) return;
    try {
      await api.patch(`/admin/loans/${id}/status`, { status });
      toast.success(`Loan ${status} successfully.`);
      loadLoans();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to update loan status.");
    }
  };

  const viewUserDetails = async (u: User) => {
    setSelectedUser(u);
    setAccountsLoading(true);
    try {
      const res = await api.get(`/admin/users/${u.id}`);
      setUserAccounts(res.data.data.user.accounts || []);
    } catch {
      toast.error("Failed to load user accounts.");
    } finally {
      setAccountsLoading(false);
    }
  };

  const handleAccountStatus = async (accountId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "frozen" : "active";
    try {
      await api.patch(`/admin/accounts/${accountId}/status`, { status: nextStatus });
      toast.success(`Account status updated to ${nextStatus}.`);
      // Reload accounts inside modal
      if (selectedUser) {
        const res = await api.get(`/admin/users/${selectedUser.id}`);
        setUserAccounts(res.data.data.user.accounts || []);
      }
      loadStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to update account status.");
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <TrendingUp size={15} /> },
    { key: "users", label: "Users", icon: <Users size={15} /> },
    { key: "transactions", label: "Transactions", icon: <ArrowLeftRight size={15} /> },
    { key: "loans", label: "Pending Loans", icon: <Wallet size={15} /> },
    { key: "audit", label: "Audit Logs", icon: <Activity size={15} /> },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        {/* Header */}
        <div className="page-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ShieldCheck size={20} color="white" />
            </div>
            <div>
              <h1 className="page-title">Admin Panel</h1>
              <p className="page-subtitle">System management and oversight controls</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 28,
          background: "var(--bg-card)", borderRadius: 12,
          padding: 4, width: "fit-content",
          border: "1px solid var(--border)",
        }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 18px", borderRadius: 9, border: "none",
              background: tab === t.key ? "var(--accent)" : "transparent",
              color: tab === t.key ? "white" : "var(--text-secondary)",
              fontWeight: tab === t.key ? 600 : 500,
              fontSize: 13, cursor: "pointer",
              transition: "all 0.15s",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ─── OVERVIEW TAB ─────────────────────────────────────────── */}
        {tab === "overview" && stats && (
          <div className="fade-in">
            {/* Big Stat Cards */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
              {[
                { label: "Total Users", value: stats.users.total, sub: `${stats.users.active} active · ${stats.users.suspended} suspended`, icon: <Users size={20} />, color: "#3b82f6" },
                { label: "Total Accounts", value: stats.accounts.total, sub: `${stats.accounts.frozen} frozen`, icon: <Wallet size={20} />, color: "#10b981" },
                { label: "Transactions", value: stats.transactions.total, sub: `${stats.transactions.completed} completed · ${stats.transactions.failed} failed`, icon: <ArrowLeftRight size={20} />, color: "#818cf8" },
                { label: "Cards Issued", value: stats.cards.total, sub: `${stats.cards.blocked} blocked`, icon: <CreditCard size={20} />, color: "#f59e0b" },
              ].map(({ label, value, sub, icon, color }) => (
                <div key={label} className="stat-card">
                  <div className="stat-icon" style={{ background: `${color}20`, color }}>
                    {icon}
                  </div>
                  <div className="stat-value">{value.toLocaleString()}</div>
                  <div className="stat-label">{label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{sub}</div>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>Total Transaction Volume</div>
                  <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-1px" }} className="gradient-text">
                    ${Number(stats.transactions.totalVolume).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
                    {stats.transactions.completed} completed transactions processed
                  </div>
                </div>
                <div style={{
                  width: 80, height: 80,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(129,140,248,0.15))",
                  border: "1px solid rgba(59,130,246,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <TrendingUp size={32} color="var(--accent)" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── USERS TAB ────────────────────────────────────────────── */}
        {tab === "users" && (
          <div className="fade-in">
            {/* Search & Filters */}
            <div className="glass-card" style={{ padding: "14px 20px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Search size={15} color="var(--text-muted)" />
              <input className="form-input" style={{ flex: 1, minWidth: 200, maxWidth: 280 }}
                placeholder="Search by name or email..."
                value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-input" style={{ width: 140 }}
                value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                <option value="customer">Customer</option>
                <option value="teller">Teller</option>
                <option value="admin">Admin</option>
              </select>
              <select className="form-input" style={{ width: 140 }}
                value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="verified">Verified Users</option>
              </select>
              <button className="btn-ghost" style={{ fontSize: 13, padding: "10px 16px" }}
                onClick={() => { setSearch(""); setRoleFilter(""); setStatusFilter(""); }}>
                Clear
              </button>
            </div>

            <div className="glass-card" style={{ padding: 24 }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: 60 }}><span className="spinner" /></div>
              ) : users.length === 0 ? (
                <div className="empty-state"><Users size={40} /><p>No users found</p></div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Accounts</th><th>KYC</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div onClick={() => viewUserDetails(u)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: "50%",
                              background: "linear-gradient(135deg, #3b82f6, #818cf8)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0,
                            }}>
                              {u.firstName[0]}{u.lastName[0]}
                            </div>
                            <span style={{ fontWeight: 600, color: "var(--accent)" }}>{u.firstName} {u.lastName}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{u.email}</td>
                        <td>
                          <span className={`badge ${u.role === "admin" ? "badge-danger" : u.role === "teller" ? "badge-warning" : "badge-info"}`}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>{u._count.accounts}</td>
                        <td>
                          <button onClick={() => handleVerifyKYC(u.id, u.status)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                            <span className={`badge ${u.status === "verified" ? "badge-success" : "badge-warning"}`}>
                              {u.status === "verified" ? "Verified" : "Pending"}
                            </span>
                          </button>
                        </td>
                        <td>
                          <span className={`badge ${u.status === "suspended" ? "badge-danger" : "badge-success"}`}>
                            {u.status === "suspended" ? "Suspended" : "Active"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            {u.status === "suspended" ? (
                              <button className="copy-btn" title="Reactivate" onClick={() => handleUserStatus(u.id, "active")} style={{ color: "var(--success)" }}>
                                <CheckCircle size={15} />
                              </button>
                            ) : (
                              <button className="copy-btn" title="Suspend" onClick={() => handleUserStatus(u.id, "suspended")} style={{ color: "var(--warning)" }}>
                                <Ban size={15} />
                              </button>
                            )}
                            <button className="copy-btn" title="Delete User" onClick={() => handleDeleteUser(u.id)} style={{ color: "var(--danger)" }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ─── TRANSACTIONS TAB ─────────────────────────────────────── */}
        {tab === "transactions" && (
          <div className="fade-in">
            <div className="glass-card" style={{ padding: "14px 20px", marginBottom: 20, display: "flex", gap: 12 }}>
              <select className="form-input" style={{ width: 180 }}
                value={txTypeFilter} onChange={e => setTxTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                <option value="transfer">Transfer</option>
                <option value="deposit">Deposit</option>
              </select>
            </div>

            <div className="glass-card" style={{ padding: 24 }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: 60 }}><span className="spinner" /></div>
              ) : transactions.length === 0 ? (
                <div className="empty-state"><ArrowLeftRight size={40} /><p>No transactions found</p></div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Type</th><th>Amount</th><th>Sender</th><th>Recipient</th><th>Status</th><th>Date</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx: any) => (
                      <tr key={tx.id}>
                        <td style={{ textTransform: "capitalize", fontSize: 13, fontWeight: 500 }}>{tx.transactionType}</td>
                        <td style={{ fontWeight: 700 }}>
                          {tx.currency} {Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          {tx.sourceAccount ? (
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{tx.sourceAccount.user?.firstName} {tx.sourceAccount.user?.lastName}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{tx.sourceAccount.accountNumber}</div>
                            </div>
                          ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                        <td>
                          {tx.destinationAccount ? (
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{tx.destinationAccount.user?.firstName} {tx.destinationAccount.user?.lastName}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{tx.destinationAccount.accountNumber}</div>
                            </div>
                          ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                        <td>
                          <span className={`badge ${tx.status === "completed" ? "badge-success" : tx.status === "reversed" ? "badge-info" : "badge-danger"}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          {tx.status === "completed" && (
                            <button className="copy-btn" title="Reverse Transaction" onClick={() => handleReverseTransaction(tx.id)} style={{ color: "var(--danger)" }}>
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ─── AUDIT LOGS TAB ───────────────────────────────────────── */}
        {tab === "audit" && (
          <div className="fade-in">
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <AlertTriangle size={16} color="var(--warning)" />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Immutable audit trail of all system actions. Records cannot be deleted.
                </span>
              </div>

              {loading ? (
                <div style={{ textAlign: "center", padding: 60 }}><span className="spinner" /></div>
              ) : auditLogs.length === 0 ? (
                <div className="empty-state"><Activity size={40} /><p>No audit logs yet</p></div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>User</th><th>Action</th><th>IP Address</th><th>Timestamp</th></tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id}>
                        <td>
                          {log.user ? (
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{log.user.firstName} {log.user.lastName}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{log.user.email}</div>
                            </div>
                          ) : <span style={{ color: "var(--text-muted)" }}>System</span>}
                        </td>
                        <td>
                          <code style={{
                            fontSize: 11, background: "var(--bg-secondary)",
                            padding: "3px 8px", borderRadius: 6,
                            color: log.action.includes("FAILED") ? "var(--danger)"
                              : log.action.includes("ADMIN") ? "#818cf8"
                              : "var(--text-secondary)",
                            display: "block", maxWidth: 340,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {log.action}
                          </code>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                          {log.ipAddress || "—"}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ─── LOANS TAB ────────────────────────────────────────────── */}
        {tab === "loans" && (
          <div className="fade-in">
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <Wallet size={16} color="var(--accent)" />
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Pending Loan Applications</h2>
              </div>
              
              {loading ? (
                <div style={{ textAlign: "center", padding: 60 }}><span className="spinner" /></div>
              ) : loans.length === 0 ? (
                <div className="empty-state"><CheckCircle size={40} /><p>No pending loans to approve.</p></div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>User</th><th>Loan Type</th><th>Amount</th><th>Term</th><th>Date</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {loans.map(loan => (
                      <tr key={loan.id}>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{loan.user?.firstName} {loan.user?.lastName}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{loan.user?.email}</div>
                        </td>
                        <td style={{ textTransform: "capitalize", fontSize: 13, fontWeight: 500 }}>{loan.loanType}</td>
                        <td style={{ fontWeight: 700 }}>
                          ${Number(loan.principalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td>{loan.termMonths} Months</td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {new Date(loan.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="copy-btn" title="Approve Loan" onClick={() => handleApproveRejectLoan(loan.id, "approved")} style={{ color: "var(--success)" }}>
                              <CheckCircle size={15} /> Approve
                            </button>
                            <button className="copy-btn" title="Reject Loan" onClick={() => handleApproveRejectLoan(loan.id, "rejected")} style={{ color: "var(--danger)" }}>
                              <Ban size={15} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── User Details & Account Freeze Modal ──────────────── */}
        {selectedUser && (
          <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>User Profile Controls</h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Manage bank accounts for {selectedUser.firstName} {selectedUser.lastName}
                  </p>
                </div>
                <button onClick={() => setSelectedUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                  <X size={18} />
                </button>
              </div>

              {accountsLoading ? (
                <div style={{ textAlign: "center", padding: 30 }}><span className="spinner" /></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {userAccounts.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No accounts linked to this user.</p>
                  ) : (
                    userAccounts.map(acc => (
                      <div key={acc.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "14px 18px", background: "var(--bg-secondary)",
                        border: "1px solid var(--border)", borderRadius: 12,
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{acc.accountType} Account</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{acc.accountNumber}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>
                            ${Number(acc.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                          <span className={`badge ${acc.status === "active" ? "badge-success" : acc.status === "frozen" ? "badge-info" : "badge-danger"}`}>
                            {acc.status}
                          </span>
                          {acc.status !== "closed" && (
                            <button
                              onClick={() => handleAccountStatus(acc.id, acc.status)}
                              className="btn-ghost"
                              style={{ padding: "4px 10px", fontSize: 11, display: "flex", gap: 4, alignItems: "center" }}
                            >
                              {acc.status === "active" ? <><Ban size={10} /> Freeze</> : <><CheckCircle size={10} /> Unfreeze</>}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// Inline SVG fallback
const ArrowLeftRight = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);
