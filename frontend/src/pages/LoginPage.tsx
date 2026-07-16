import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Landmark, Eye, EyeOff, X, KeyRound, ShieldAlert } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Forgot password flow state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [step, setStep] = useState(1); // 1 = enter email, 2 = enter OTP and new password
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", form);
      login(res.data.data.accessToken, res.data.data.user);
      toast.success("Welcome back to QuantaBank!");
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email: forgotEmail });
      toast.success("If an account exists, a reset code was sent to your email!");
      setStep(2);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Something went wrong.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword.trim()) return;
    setForgotSubmitting(true);
    try {
      await api.post("/auth/reset-password", {
        email: forgotEmail,
        otp,
        newPassword,
      });
      toast.success("Password reset successfully! Log in now.");
      setShowForgot(false);
      setStep(1);
      setForgotEmail("");
      setOtp("");
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card fade-in">
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56,
            background: "linear-gradient(135deg, #3b82f6, #818cf8)",
            borderRadius: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 0 30px rgba(59,130,246,0.3)",
          }}>
            <Landmark size={26} color="white" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
            Sign in to your QuantaBank account
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              id="login-email"
            />
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label">Password</label>
              <button
                type="button"
                onClick={() => { setShowForgot(true); setStep(1); setError(""); }}
                style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
              >
                Forgot Password?
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <input
                className="form-input"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                style={{ paddingRight: 44 }}
                id="login-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: "absolute", right: 14, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none",
                  color: "var(--text-muted)", cursor: "pointer"
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading} id="login-submit" style={{ width: "100%", marginTop: 4 }}>
            {loading ? <span className="spinner" /> : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--text-secondary)" }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            Create one
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="modal-overlay" onClick={() => setShowForgot(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: "rgba(59,130,246,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <KeyRound size={18} color="var(--accent)" />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>Reset Password</h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Recover access to your account</p>
                </div>
              </div>
              <button onClick={() => setShowForgot(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                <X size={18} />
              </button>
            </div>

            {step === 1 ? (
              <form onSubmit={handleRequestOTP} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Account Email Address</label>
                  <input
                    className="form-input"
                    type="email"
                    required
                    placeholder="Enter your registered email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                  />
                  <div className="field-hint">We will email you a 6-digit verification code to reset your password.</div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowForgot(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={forgotSubmitting}>
                    {forgotSubmitting ? <span className="spinner" /> : "Send Code"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{
                  background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
                  borderRadius: 10, padding: "12px 14px", display: "flex", gap: 8, fontSize: 12, color: "var(--text-secondary)",
                }}>
                  <ShieldAlert size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>A recovery code has been sent to your email. Check your spam folder if you can't find it.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">6-Digit Verification Code</label>
                  <input
                    className="form-input"
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    style={{ letterSpacing: 4, textAlign: "center", fontSize: 18, fontWeight: 700 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    className="form-input"
                    type="password"
                    required
                    placeholder="At least 8 characters, 1 uppercase, 1 digit"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={forgotSubmitting}>
                    {forgotSubmitting ? <span className="spinner" /> : "Reset Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
