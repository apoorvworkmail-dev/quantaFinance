import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  Lock, Shield, Bell, Eye, EyeOff,
  CheckCircle, Globe, AlertTriangle, Smartphone,
} from 'lucide-react';

export const SettingsPage = () => {
  const { user, logout } = useAuth();
  const toast = useToast();

  // Password form
  const [pwForm, setPwForm] = useState({ current: '', newPass: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPass: false, confirm: false });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  // Notification toggles (UI only — email backend not wired)
  const [notifications, setNotifications] = useState({
    loginAlerts: true,
    transferAlerts: true,
    weeklyReport: false,
    marketingEmails: false,
  });

  // Password strength scorer
  const getStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    if (pass.length >= 12) score++;
    return score;
  };

  const strength = getStrength(pwForm.newPass);
  const strengthLabels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const strengthColors = ['', '#ef4444', '#f59e0b', '#eab308', '#10b981', '#10b981'];

  const validatePassword = () => {
    const errs: Record<string, string> = {};
    if (!pwForm.current) errs.current = 'Current password is required';
    if (pwForm.newPass.length < 8) errs.newPass = 'Must be at least 8 characters';
    if (!/[A-Z]/.test(pwForm.newPass)) errs.newPass = 'Must contain at least one uppercase letter';
    if (!/[0-9]/.test(pwForm.newPass)) errs.newPass = 'Must contain at least one number';
    if (pwForm.newPass !== pwForm.confirm) errs.confirm = 'Passwords do not match';
    return errs;
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validatePassword();
    if (Object.keys(errs).length > 0) { setPwErrors(errs); return; }
    setPwErrors({});
    setPwLoading(true);
    await new Promise(r => setTimeout(r, 1000)); // Simulated API
    setPwLoading(false);
    setPwForm({ current: '', newPass: '', confirm: '' });
    toast.success('Password updated successfully!');
  };

  const PasswordField = ({
    label, field, placeholder,
  }: { label: string; field: keyof typeof pwForm; placeholder: string }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className={`form-input ${pwErrors[field] ? 'invalid' : ''}`}
          type={showPw[field] ? 'text' : 'password'}
          placeholder={placeholder}
          value={pwForm[field]}
          onChange={e => setPwForm({ ...pwForm, [field]: e.target.value })}
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={() => setShowPw({ ...showPw, [field]: !showPw[field] })}
          style={{
            position: 'absolute', right: 14, top: '50%',
            transform: 'translateY(-50%)',
            background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
          }}
        >
          {showPw[field] ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {pwErrors[field] && <div className="field-error">{pwErrors[field]}</div>}
    </div>
  );

  const notifItems = [
    { key: 'loginAlerts',     label: 'Login alerts',      sub: 'Notify when someone signs in to your account' },
    { key: 'transferAlerts',  label: 'Transfer alerts',   sub: 'Notify on every transaction' },
    { key: 'weeklyReport',    label: 'Weekly report',     sub: 'Summary email every Monday' },
    { key: 'marketingEmails', label: 'Marketing emails',  sub: 'Product updates and promotions' },
  ] as const;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account preferences and security</p>
        </div>

        <div className="grid-2" style={{ gap: 24 }}>

          {/* ── Change Password ───────────────────────── */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={18} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Change Password</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Keep your account secure</div>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <PasswordField label="Current Password" field="current" placeholder="Enter current password" />
              <PasswordField label="New Password" field="newPass" placeholder="Min 8 chars, 1 uppercase, 1 number" />

              {/* Strength meter */}
              {pwForm.newPass && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Password strength</span>
                    <span style={{ color: strengthColors[strength], fontWeight: 600 }}>{strengthLabels[strength]}</span>
                  </div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar" style={{ width: `${(strength / 5) * 100}%`, background: strengthColors[strength] }} />
                  </div>
                </div>
              )}

              <PasswordField label="Confirm New Password" field="confirm" placeholder="Repeat new password" />

              <button type="submit" className="btn-primary" disabled={pwLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {pwLoading ? <span className="spinner" /> : 'Update Password'}
              </button>
            </form>
          </div>

          {/* ── Notifications ─────────────────────────── */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={18} color="var(--warning)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Notifications</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Control what alerts you receive</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifItems.map(({ key, label, sub }) => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', background: 'var(--bg-secondary)',
                  borderRadius: 12, border: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
                  </div>
                  <button
                    className="toggle-track"
                    style={{ background: notifications[key] ? 'var(--accent)' : 'var(--border)' }}
                    onClick={() => {
                      setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
                      toast.info(`${label} ${notifications[key] ? 'disabled' : 'enabled'}`);
                    }}
                    aria-label={`Toggle ${label}`}
                  >
                    <div className="toggle-thumb" style={{ left: notifications[key] ? 23 : 3 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Security Status ───────────────────────── */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} color="var(--success)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Security Status</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Your account protection overview</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: <CheckCircle size={14} color="var(--success)" />, label: 'Password protected',   value: 'Enabled',      color: 'var(--success)' },
                { icon: <CheckCircle size={14} color="var(--success)" />, label: 'bcrypt hashing',       value: '12 rounds',    color: 'var(--success)' },
                { icon: <CheckCircle size={14} color="var(--success)" />, label: 'JWT session tokens',   value: 'Active',       color: 'var(--success)' },
                { icon: <CheckCircle size={14} color="var(--success)" />, label: 'Rate limiting',        value: 'Active',       color: 'var(--success)' },
                { icon: <CheckCircle size={14} color="var(--success)" />, label: 'Audit logging',        value: 'Active',       color: 'var(--success)' },
                { icon: <AlertTriangle size={14} color="var(--warning)" />, label: '2-Factor Auth',     value: 'Coming soon',  color: 'var(--warning)' },
              ].map(({ icon, label, value, color }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: 'var(--bg-secondary)',
                  borderRadius: 10, border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {icon}
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Session / Danger Zone ─────────────────── */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone size={18} color="var(--danger)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Session & Account</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current session details</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {[
                { icon: <Globe size={13} />,      label: 'Email',           value: user?.email },
                { icon: <Shield size={13} />,     label: 'Role',            value: user?.role },
                { icon: <Smartphone size={13} />, label: 'Token expiry',    value: '15 minutes' },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: 'var(--bg-secondary)',
                  borderRadius: 10, border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                    {icon} {label}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>Sign out</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                This will end your current session on this device.
              </div>
              <button
                className="btn-danger"
                style={{ width: '100%', fontSize: 13 }}
                onClick={() => { logout(); window.location.href = '/login'; }}
              >
                Sign Out Now
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
