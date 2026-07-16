import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { TableRowSkeleton } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import jsPDF from 'jspdf';
import {
  ArrowUpRight, ArrowDownLeft,
  Copy, Check, ChevronLeft, ChevronRight,
  CheckCircle, Download, X, Search, FileDown,
  ArrowUpDown, ShieldAlert,
} from 'lucide-react';

interface Account {
  id: string; accountNumber: string; accountType: string;
  balance: number; status: string;
}
interface Transaction {
  id: string; amount: number; currency: string;
  transactionType: string; status: string; createdAt: string;
  referenceDescription?: string;
  sourceAccount?: { accountNumber: string };
  destinationAccount?: { accountNumber: string };
}
interface Receipt {
  type: string; amount: number; currency: string;
  from?: string; to?: string; description?: string;
  date: string; status: string; refId: string;
}

const LIMIT = 10;

export const TransactionsPage = () => {
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter/Search/Sort
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // Transfer OTP verification state
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [transferForm, setTransferForm] = useState({
    fromAccountId: '', toAccountNumber: '', amount: '', description: '', otpCode: '',
  });
  const [depositForm, setDepositForm] = useState({
    toAccountId: '', amount: '', description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({});

  // Check URL query parameters for pre-filling beneficiary
  useEffect(() => {
    const toAcc = searchParams.get('to');
    if (toAcc) {
      setTransferForm(prev => ({ ...prev, toAccountNumber: toAcc }));
      setShowTransferModal(true);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        limit: LIMIT,
        sortBy,
        sortOrder,
      };
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      if (searchQuery) params.search = searchQuery;

      const [accRes, txRes] = await Promise.all([
        api.get('/accounts'),
        api.get('/transactions', { params }),
      ]);
      setAccounts(accRes.data.data.accounts);
      setTransactions(txRes.data.data.transactions);
      const pg = txRes.data.data.pagination;
      setTotal(pg?.total ?? txRes.data.data.transactions.length);
    } catch {
      toast.error('Failed to load transaction data.');
    } finally { setLoading(false); }
  }, [page, filterStatus, filterType, searchQuery, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    toast.success('Copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRequestOTP = async () => {
    const errs = validateTransfer();
    if (Object.keys(errs).length) { setTransferErrors(errs); return; }
    setTransferErrors({});
    setOtpLoading(true);
    setFormError('');
    try {
      await api.post('/transactions/otp');
      setOtpSent(true);
      toast.success('Verification OTP code sent to your email.');
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to request OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  const validateTransfer = () => {
    const errs: Record<string, string> = {};
    if (!transferForm.fromAccountId) errs.fromAccountId = 'Select a source account';
    if (!transferForm.toAccountNumber.trim()) errs.toAccountNumber = 'Recipient account number required';
    if (!transferForm.amount || Number(transferForm.amount) <= 0) errs.amount = 'Enter a valid amount';
    const src = accounts.find(a => a.id === transferForm.fromAccountId);
    if (src && Number(transferForm.amount) > Number(src.balance)) {
      errs.amount = `Insufficient balance (available: $${Number(src.balance).toLocaleString()})`;
    }
    return errs;
  };

  const handleTransfer = async () => {
    const errs = validateTransfer();
    if (!transferForm.otpCode || transferForm.otpCode.length !== 6) {
      errs.otpCode = 'Valid 6-digit OTP code is required';
    }
    if (Object.keys(errs).length) { setTransferErrors(errs); return; }
    setTransferErrors({});
    setSubmitting(true); setFormError('');
    try {
      const res = await api.post('/transactions/transfer', {
        ...transferForm,
        amount: Number(transferForm.amount),
        idempotencyKey: `tx-${Date.now()}-${Math.random()}`,
      });
      const tx = res.data.data.transaction;
      setShowTransferModal(false);
      setTransferForm({ fromAccountId: '', toAccountNumber: '', amount: '', description: '', otpCode: '' });
      setOtpSent(false);
      setReceipt({
        type: 'Transfer', amount: Number(tx.amount), currency: tx.currency,
        from: tx.from, to: tx.to,
        description: transferForm.description || undefined,
        date: new Date(tx.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        status: 'Completed', refId: tx.id,
      });
      load();
    } catch (e: any) {
      setFormError(e.response?.data?.message || 'Transfer failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  const handleDeposit = async () => {
    if (!depositForm.toAccountId || !depositForm.amount || Number(depositForm.amount) <= 0) {
      setFormError('Please fill in all fields with valid values.');
      return;
    }
    setSubmitting(true); setFormError('');
    try {
      const acc = accounts.find(a => a.id === depositForm.toAccountId);
      const res = await api.post('/transactions/deposit', {
        ...depositForm, amount: Number(depositForm.amount),
      });
      const tx = res.data.data.transaction;
      setShowDepositModal(false);
      setDepositForm({ toAccountId: '', amount: '', description: '' });
      setReceipt({
        type: 'Deposit', amount: Number(tx.amount), currency: tx.currency,
        to: acc?.accountNumber,
        description: depositForm.description || undefined,
        date: new Date(tx.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        status: 'Completed', refId: tx.id,
      });
      load();
    } catch (e: any) {
      setFormError(e.response?.data?.message || 'Deposit failed.');
    } finally { setSubmitting(false); }
  };

  // PDF Receipt Generation
  const downloadReceiptPDF = (r: Receipt) => {
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 297, 'F');

    // Branding header
    doc.setTextColor(59, 130, 246);
    doc.setFontSize(26);
    doc.setFont('Helvetica', 'bold');
    doc.text('🏦 QuantaBank', 20, 30);

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(12);
    doc.text('Official Transaction Receipt', 20, 38);

    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.5);
    doc.line(20, 45, 190, 45);

    // Box content
    doc.setFillColor(30, 41, 59);
    doc.rect(20, 55, 170, 120, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(r.type, 30, 70);

    doc.setFontSize(24);
    doc.setTextColor(16, 185, 129);
    doc.text(`+${r.currency} ${r.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 30, 85);

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(11);
    let y = 105;
    if (r.from) {
      doc.text(`Sender Account: ${r.from}`, 30, y);
      y += 10;
    }
    if (r.to) {
      doc.text(`Recipient Account: ${r.to}`, 30, y);
      y += 10;
    }
    doc.text(`Reference ID: ${r.refId}`, 30, y);
    y += 10;
    doc.text(`Date & Time: ${r.date}`, 30, y);
    y += 10;
    doc.text(`Status: ${r.status}`, 30, y);

    // Footer info
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.text('This is a secure system-generated receipt. No signature required.', 20, 200);

    doc.save(`quantabank-receipt-${r.refId}.pdf`);
    toast.success('Receipt PDF downloaded!');
  };

  // Export CSV capability
  const exportToCSV = () => {
    if (!transactions.length) return;
    const headers = ['ID', 'Type', 'Amount', 'Currency', 'From', 'To', 'Status', 'Date'];
    const rows = transactions.map(tx => [
      tx.id,
      tx.transactionType,
      tx.amount,
      tx.currency,
      tx.sourceAccount?.accountNumber || '',
      tx.destinationAccount?.accountNumber || '',
      tx.status,
      new Date(tx.createdAt).toLocaleDateString()
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `quantabank-statement-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Statement CSV exported!');
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const pageNumbers = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1);
  const fromAcc = accounts.find(a => a.id === transferForm.fromAccountId);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">

        {/* Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Transactions</h1>
            <p className="page-subtitle">{total} transaction{total !== 1 ? 's' : ''} total</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={exportToCSV} disabled={transactions.length === 0}>
              <FileDown size={15} /> Export CSV
            </button>
            <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={() => { setShowDepositModal(true); setFormError(''); }}>
              <ArrowDownLeft size={15} /> Deposit
            </button>
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={() => { setShowTransferModal(true); setFormError(''); setTransferErrors({}); setOtpSent(false); }}>
              <ArrowUpRight size={15} /> Send Money
            </button>
          </div>
        </div>

        {/* Filters/Search/Sort */}
        <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Search size={15} color="var(--text-muted)" />
          <input className="form-input" style={{ flex: 1, minWidth: 200, maxWidth: 300 }}
            placeholder="Search by note, account number or amount"
            value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} />

          <select className="form-input" style={{ width: 140 }} value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            <option value="transfer">Transfer</option>
            <option value="deposit">Deposit</option>
          </select>

          <select className="form-input" style={{ width: 140 }} value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
          </select>

          <select className="form-input" style={{ width: 140 }} value={sortBy}
            onChange={e => { setSortBy(e.target.value); setPage(1); }}>
            <option value="createdAt">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
          </select>

          <button className="btn-ghost" style={{ padding: 10 }}
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
            <ArrowUpDown size={15} />
          </button>
        </div>

        {/* Table */}
        <div className="glass-card" style={{ padding: 24 }}>
          {loading ? (
            <table className="data-table">
              <tbody>{Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)}</tbody>
            </table>
          ) : transactions.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💸</div>
              <p style={{ fontSize: 15 }}>No transactions found</p>
            </div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th><th>Amount</th><th>From</th><th>To</th><th>Status</th><th>Date</th><th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                            background: tx.transactionType === 'deposit' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {tx.transactionType === 'deposit'
                              ? <ArrowDownLeft size={13} color="var(--success)" />
                              : <ArrowUpRight size={13} color="var(--accent)" />}
                          </div>
                          <span style={{ textTransform: 'capitalize', fontSize: 13 }}>{tx.transactionType}</span>
                        </div>
                      </td>
                      <td>
                        <span className={tx.transactionType === 'deposit' ? 'tx-credit' : 'tx-debit'} style={{ fontWeight: 700 }}>
                          {tx.transactionType === 'deposit' ? '+' : '−'}
                          {tx.currency} {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td>
                        {tx.sourceAccount?.accountNumber ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {tx.sourceAccount.accountNumber}
                            </span>
                            <button className="copy-btn"
                              onClick={() => copyToClipboard(tx.sourceAccount!.accountNumber, `s${tx.id}`)}>
                              {copiedId === `s${tx.id}` ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                            </button>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        {tx.destinationAccount?.accountNumber ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {tx.destinationAccount.accountNumber}
                            </span>
                            <button className="copy-btn"
                              onClick={() => copyToClipboard(tx.destinationAccount!.accountNumber, `d${tx.id}`)}>
                              {copiedId === `d${tx.id}` ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                            </button>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        <span className={`badge ${tx.status === 'completed' ? 'badge-success' : tx.status === 'reversed' ? 'badge-info' : tx.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td>
                        <button className="copy-btn" title="Download Receipt PDF" onClick={() => downloadReceiptPDF({
                          type: tx.transactionType === 'deposit' ? 'Cash Deposit' : 'Fund Transfer',
                          amount: Number(tx.amount),
                          currency: tx.currency,
                          from: tx.sourceAccount?.accountNumber,
                          to: tx.destinationAccount?.accountNumber,
                          date: new Date(tx.createdAt).toLocaleString(),
                          status: tx.status,
                          refId: tx.id,
                        })}>
                          <Download size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="pagination">
                <div className="pagination-info">
                  Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total}
                </div>
                <div className="pagination-controls">
                  <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                    <ChevronLeft size={14} />
                  </button>
                  {pageNumbers.map(p => (
                    <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>
                      {p}
                    </button>
                  ))}
                  <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Transfer Modal ──────────────────────────────────── */}
        {showTransferModal && (
          <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>Send Money</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Secure Transfer with Email OTP Authorization</p>
                </div>
                <button onClick={() => setShowTransferModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>

              {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{formError}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
                <div className="form-group">
                  <label className="form-label">From Account</label>
                  <select className={`form-input ${transferErrors.fromAccountId ? 'invalid' : ''}`}
                    value={transferForm.fromAccountId}
                    disabled={otpSent}
                    onChange={e => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}>
                    <option value="">Select source account</option>
                    {accounts.filter(a => a.status === 'active').map(a => (
                      <option key={a.id} value={a.id}>
                        {a.accountType} · {a.accountNumber} — ${Number(a.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                  {transferErrors.fromAccountId && <div className="field-error">{transferErrors.fromAccountId}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">To Account Number</label>
                  <input className={`form-input ${transferErrors.toAccountNumber ? 'invalid' : ''}`}
                    type="text" placeholder="e.g. QB12345678"
                    disabled={otpSent}
                    value={transferForm.toAccountNumber}
                    onChange={e => setTransferForm({ ...transferForm, toAccountNumber: e.target.value })} />
                  {transferErrors.toAccountNumber && <div className="field-error">{transferErrors.toAccountNumber}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (USD)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>$</span>
                    <input className={`form-input ${transferErrors.amount ? 'invalid' : ''}`}
                      type="number" placeholder="0.00" min="1"
                      disabled={otpSent}
                      style={{ paddingLeft: 28 }}
                      value={transferForm.amount}
                      onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })} />
                  </div>
                  {transferErrors.amount
                    ? <div className="field-error">{transferErrors.amount}</div>
                    : fromAcc && <div className="field-hint">Available: ${Number(fromAcc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  }
                </div>

                <div className="form-group">
                  <label className="form-label">Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="form-input" type="text" placeholder="Rent, bills..."
                    disabled={otpSent}
                    value={transferForm.description}
                    onChange={e => setTransferForm({ ...transferForm, description: e.target.value })} />
                </div>

                {otpSent && (
                  <div className="form-group" style={{ background: 'rgba(59,130,246,0.06)', padding: 14, borderRadius: 10, border: '1px solid rgba(59,130,246,0.15)' }}>
                    <div style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      <ShieldAlert size={16} color="var(--accent)" />
                      <span>Input the 6-digit transaction verification code emailed to you.</span>
                    </div>
                    <label className="form-label">Verification OTP</label>
                    <input className={`form-input ${transferErrors.otpCode ? 'invalid' : ''}`}
                      type="text" maxLength={6} placeholder="e.g. 123456"
                      value={transferForm.otpCode}
                      onChange={e => setTransferForm({ ...transferForm, otpCode: e.target.value })}
                      style={{ letterSpacing: 6, textAlign: 'center', fontSize: 18, fontWeight: 700 }} />
                    {transferErrors.otpCode && <div className="field-error">{transferErrors.otpCode}</div>}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowTransferModal(false)}>Cancel</button>
                {!otpSent ? (
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleRequestOTP} disabled={otpLoading}>
                    {otpLoading ? <span className="spinner" /> : 'Get OTP Code'}
                  </button>
                ) : (
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleTransfer} disabled={submitting}>
                    {submitting ? <span className="spinner" /> : 'Verify & Send'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Deposit Modal ───────────────────────────────────── */}
        {showDepositModal && (
          <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>Deposit Funds</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Add money to your account</p>
                </div>
                <button onClick={() => setShowDepositModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>

              {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{formError}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
                <div className="form-group">
                  <label className="form-label">Into Account</label>
                  <select className="form-input" value={depositForm.toAccountId}
                    onChange={e => setDepositForm({ ...depositForm, toAccountId: e.target.value })}>
                    <option value="">Select account</option>
                    {accounts.filter(a => a.status === 'active').map(a => (
                      <option key={a.id} value={a.id}>{a.accountType} · {a.accountNumber}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (USD)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>$</span>
                    <input className="form-input" type="number" placeholder="0.00" min="1"
                      style={{ paddingLeft: 28 }}
                      value={depositForm.amount}
                      onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="form-input" type="text" placeholder="Salary, cash deposit..."
                    value={depositForm.description}
                    onChange={e => setDepositForm({ ...depositForm, description: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowDepositModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleDeposit} disabled={submitting}>
                  {submitting ? <span className="spinner" /> : 'Deposit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Receipt Modal ───────────────────────────────────── */}
        {receipt && (
          <div className="modal-overlay" onClick={() => setReceipt(null)}>
            <div className="receipt-modal" onClick={e => e.stopPropagation()}>
              <div className="receipt-icon">
                <CheckCircle size={36} color="var(--success)" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Transaction Successful!</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
                Your {receipt.type.toLowerCase()} has been processed
              </p>

              <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '4px 16px', marginBottom: 24, textAlign: 'left' }}>
                <div className="receipt-row">
                  <span className="receipt-label">Type</span>
                  <span className="receipt-value">{receipt.type}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Amount</span>
                  <span className="receipt-value" style={{ color: 'var(--success)', fontSize: 18 }}>
                    +{receipt.currency} {receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {receipt.from && (
                  <div className="receipt-row">
                    <span className="receipt-label">From</span>
                    <span className="receipt-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{receipt.from}</span>
                  </div>
                )}
                {receipt.to && (
                  <div className="receipt-row">
                    <span className="receipt-label">To</span>
                    <span className="receipt-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{receipt.to}</span>
                  </div>
                )}
                {receipt.description && (
                  <div className="receipt-row">
                    <span className="receipt-label">Note</span>
                    <span className="receipt-value">{receipt.description}</span>
                  </div>
                )}
                <div className="receipt-row">
                  <span className="receipt-label">Reference</span>
                  <span className="receipt-value" style={{ fontFamily: 'monospace', fontSize: 11 }}>{receipt.refId}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Date & Time</span>
                  <span className="receipt-value" style={{ fontSize: 12 }}>{receipt.date}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Status</span>
                  <span className="badge badge-success">{receipt.status}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setReceipt(null)}>Close</button>
                <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                  onClick={() => downloadReceiptPDF(receipt)}>
                  <Download size={14} /> Download Receipt
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
