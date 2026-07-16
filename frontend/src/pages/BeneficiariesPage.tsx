import React, { useEffect, useState, useCallback } from "react";
import { Sidebar } from "../components/Sidebar";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../context/ToastContext";
import api from "../api/client";
import {
  Users, Plus, Trash2, Edit2, ToggleLeft, ToggleRight,
  Search, CheckCircle, X, AlertTriangle, Send,
} from "lucide-react";

interface Beneficiary {
  id: string;
  nickname: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string | null;
  status: string;
  createdAt: string;
}

const initialForm = { nickname: "", accountNumber: "", bankName: "QuantaBank", ifscCode: "" };

export const BeneficiariesPage = () => {
  const toast = useToast();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Beneficiary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Beneficiary | null>(null);

  // Form state
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/beneficiaries");
      setBeneficiaries(res.data.data.beneficiaries);
    } catch {
      toast.error("Failed to load beneficiaries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = beneficiaries.filter(b => {
    const matchSearch = !search ||
      b.nickname.toLowerCase().includes(search.toLowerCase()) ||
      b.accountNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.bankName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!form.nickname.trim()) errs.nickname = "Nickname is required";
    if (!form.accountNumber.trim()) errs.accountNumber = "Account number is required";
    if (form.bankName === "QuantaBank" && !/^QB\d{8,12}$/i.test(form.accountNumber)) {
      errs.accountNumber = "QuantaBank accounts must start with QB followed by 8–12 digits";
    }
    return errs;
  };

  const handleAdd = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setFormErrors({});
    setSubmitting(true);
    try {
      await api.post("/beneficiaries", form);
      toast.success(`${form.nickname} added to beneficiaries!`);
      setShowAdd(false);
      setForm(initialForm);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to add beneficiary.");
    } finally { setSubmitting(false); }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setSubmitting(true);
    try {
      await api.put(`/beneficiaries/${editTarget.id}`, {
        nickname: form.nickname,
        bankName: form.bankName,
        ifscCode: form.ifscCode,
      });
      toast.success("Beneficiary updated!");
      setEditTarget(null);
      setForm(initialForm);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to update.");
    } finally { setSubmitting(false); }
  };

  const handleToggleStatus = async (b: Beneficiary) => {
    const newStatus = b.status === "active" ? "inactive" : "active";
    try {
      await api.patch(`/beneficiaries/${b.id}/status`, { status: newStatus });
      toast.success(`${b.nickname} ${newStatus === "active" ? "activated" : "deactivated"}`);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to update status.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/beneficiaries/${deleteTarget.id}`);
      toast.success(`${deleteTarget.nickname} removed`);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to delete.");
    }
  };

  const openEdit = (b: Beneficiary) => {
    setEditTarget(b);
    setForm({ nickname: b.nickname, accountNumber: b.accountNumber, bankName: b.bankName, ifscCode: b.ifscCode || "" });
  };

  const BankIcon = ({ bank }: { bank: string }) => (
    <div style={{
      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
      background: bank === "QuantaBank" ? "linear-gradient(135deg,#3b82f6,#818cf8)" : "linear-gradient(135deg,#f59e0b,#ef4444)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 800, color: "white",
    }}>
      {bank[0]}
    </div>
  );

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        {/* Header */}
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title">Beneficiaries</h1>
            <p className="page-subtitle">{beneficiaries.length} saved recipient{beneficiaries.length !== 1 ? "s" : ""}</p>
          </div>
          <button className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}
            onClick={() => { setShowAdd(true); setForm(initialForm); setFormErrors({}); }}>
            <Plus size={15} /> Add Beneficiary
          </button>
        </div>

        {/* Search & Filter bar */}
        <div className="glass-card" style={{ padding: "14px 20px", marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Search size={15} color="var(--text-muted)" />
          <input className="form-input" style={{ flex: 1, minWidth: 200, maxWidth: 320 }}
            placeholder="Search by name, account or bank..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-input" style={{ width: 150 }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(search || filterStatus) && (
            <button className="btn-ghost" style={{ fontSize: 13, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => { setSearch(""); setFilterStatus(""); }}>
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* Beneficiary Grid */}
        {loading ? (
          <div className="grid-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Skeleton width={38} height={38} borderRadius={10} />
                  <div style={{ flex: 1 }}>
                    <Skeleton width="60%" height={15} borderRadius={6} />
                    <Skeleton width="40%" height={11} borderRadius={6} style={{ marginTop: 6 }} />
                  </div>
                </div>
                <Skeleton height={36} borderRadius={10} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <Users size={48} />
            <p style={{ fontSize: 15 }}>
              {beneficiaries.length === 0
                ? "No beneficiaries yet. Add your first recipient to send money faster."
                : "No results match your search."}
            </p>
            {beneficiaries.length === 0 && (
              <button className="btn-primary" style={{ marginTop: 20 }}
                onClick={() => setShowAdd(true)}>
                Add First Beneficiary
              </button>
            )}
          </div>
        ) : (
          <div className="grid-3">
            {filtered.map(b => (
              <div key={b.id} className="glass-card" style={{
                padding: 20,
                border: b.status === "inactive" ? "1px solid var(--border)" : "1px solid var(--border)",
                opacity: b.status === "inactive" ? 0.7 : 1,
                transition: "all 0.2s",
              }}>
                {/* Card Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <BankIcon bank={b.bankName} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                      {b.nickname}
                      <span className={`badge ${b.status === "active" ? "badge-success" : "badge-warning"}`} style={{ fontSize: 10 }}>
                        {b.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{b.bankName}</div>
                  </div>
                </div>

                {/* Account Details */}
                <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Account Number</div>
                  <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>
                    {b.accountNumber}
                  </div>
                  {b.ifscCode && (
                    <>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, marginBottom: 3 }}>IFSC</div>
                      <div style={{ fontFamily: "monospace", fontSize: 13 }}>{b.ifscCode}</div>
                    </>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 6 }}>
                  <a href={`/transactions?to=${b.accountNumber}`}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      background: b.status === "active" ? "var(--accent)" : "var(--bg-secondary)",
                      color: b.status === "active" ? "white" : "var(--text-muted)",
                      border: "none", borderRadius: 10, padding: "8px 0", fontSize: 13,
                      fontWeight: 600, cursor: b.status === "active" ? "pointer" : "not-allowed",
                      textDecoration: "none", fontFamily: "Inter, sans-serif",
                      pointerEvents: b.status === "active" ? "auto" : "none",
                    }}>
                    <Send size={12} /> Send
                  </a>
                  <button title="Edit" onClick={() => openEdit(b)} style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--text-secondary)", transition: "all 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                    <Edit2 size={13} />
                  </button>
                  <button title={b.status === "active" ? "Deactivate" : "Activate"} onClick={() => handleToggleStatus(b)} style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: b.status === "active" ? "var(--warning)" : "var(--success)", transition: "all 0.15s",
                  }}>
                    {b.status === "active" ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  <button title="Delete" onClick={() => setDeleteTarget(b)} style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--danger)", transition: "all 0.15s",
                  }}>
                    <Trash2 size={13} />
                  </button>
                </div>

                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, textAlign: "right" }}>
                  Added {new Date(b.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Add Beneficiary Modal ───────────────────────────── */}
        {showAdd && (
          <div className="modal-overlay" onClick={() => setShowAdd(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add Beneficiary</h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                    Save a recipient for faster transfers
                  </p>
                </div>
                <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nickname *</label>
                  <input className={`form-input ${formErrors.nickname ? "invalid" : ""}`}
                    placeholder="e.g. John's Savings, Mom"
                    value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} />
                  {formErrors.nickname && <div className="field-error">{formErrors.nickname}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <select className="form-input" value={form.bankName}
                    onChange={e => setForm({ ...form, bankName: e.target.value })}>
                    <option value="QuantaBank">QuantaBank (same bank)</option>
                    <option value="SBI">State Bank of India</option>
                    <option value="HDFC">HDFC Bank</option>
                    <option value="ICICI">ICICI Bank</option>
                    <option value="Axis">Axis Bank</option>
                    <option value="Other">Other Bank</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Account Number *</label>
                  <input className={`form-input ${formErrors.accountNumber ? "invalid" : ""}`}
                    placeholder={form.bankName === "QuantaBank" ? "QB12345678" : "Enter account number"}
                    value={form.accountNumber}
                    onChange={e => setForm({ ...form, accountNumber: e.target.value.toUpperCase() })} />
                  {formErrors.accountNumber
                    ? <div className="field-error">{formErrors.accountNumber}</div>
                    : form.bankName === "QuantaBank" && (
                      <div className="field-hint">QuantaBank accounts start with QB followed by 8–12 digits</div>
                    )}
                </div>

                {form.bankName !== "QuantaBank" && (
                  <div className="form-group">
                    <label className="form-label">IFSC Code</label>
                    <input className="form-input" placeholder="e.g. SBIN0001234"
                      value={form.ifscCode}
                      onChange={e => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })} />
                    <div className="field-hint">11-character bank branch code</div>
                  </div>
                )}

                {form.bankName === "QuantaBank" && (
                  <div style={{
                    background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
                    borderRadius: 10, padding: "12px 14px", display: "flex", gap: 8,
                  }}>
                    <CheckCircle size={15} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      The account number will be verified to exist in our system before adding.
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleAdd} disabled={submitting}>
                  {submitting ? <span className="spinner" /> : "Add Beneficiary"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Modal ──────────────────────────────────────── */}
        {editTarget && (
          <div className="modal-overlay" onClick={() => setEditTarget(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>Edit Beneficiary</h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Update nickname or IFSC code</p>
                </div>
                <button onClick={() => setEditTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nickname</label>
                  <input className="form-input" value={form.nickname}
                    onChange={e => setForm({ ...form, nickname: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Number</label>
                  <input className="form-input" value={editTarget.accountNumber} disabled
                    style={{ opacity: 0.5, cursor: "not-allowed" }} />
                  <div className="field-hint">Account number cannot be changed after adding</div>
                </div>
                {editTarget.bankName !== "QuantaBank" && (
                  <div className="form-group">
                    <label className="form-label">IFSC Code</label>
                    <input className="form-input" value={form.ifscCode}
                      onChange={e => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setEditTarget(null)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleUpdate} disabled={submitting}>
                  {submitting ? <span className="spinner" /> : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirm Modal ────────────────────────────── */}
        {deleteTarget && (
          <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
              }}>
                <AlertTriangle size={26} color="var(--danger)" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Remove Beneficiary?</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                Are you sure you want to remove <strong>{deleteTarget.nickname}</strong>?
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24 }}>
                Account: {deleteTarget.accountNumber}
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Keep</button>
                <button className="btn-danger" style={{ flex: 1 }} onClick={handleDelete}>Remove</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
