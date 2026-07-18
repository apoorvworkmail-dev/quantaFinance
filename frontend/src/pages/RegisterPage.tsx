import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Landmark, Eye, EyeOff } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export const RegisterPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "", lastName: "",
    email: "", password: "", phoneNumber: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      // Auto-login after registration
      const loginRes = await api.post("/auth/login", {
        email: form.email,
        password: form.password,
      });
      login(loginRes.data.data.accessToken, loginRes.data.data.user);
      navigate("/dashboard");
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.errors) {
        // Show field-level validation errors from Zod
        setFieldErrors(data.errors);
        setError("Please fix the errors below.");
      } else {
        setError(data?.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card fade-in" style={{ maxWidth: 460 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52,
            background: "linear-gradient(135deg, #3b82f6, #818cf8)",
            borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px",
            boxShadow: "0 0 30px rgba(59,130,246,0.3)",
          }}>
            <Landmark size={24} color="white" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>
            Open your account
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 5 }}>
            Join QuantaBank — free in minutes
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input className="form-input" type="text" placeholder="Apoorv"
                value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                required id="reg-firstname" />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-input" type="text" placeholder="Mishra"
                value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                required id="reg-lastname" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              required id="reg-email" />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number (optional)</label>
            <input className="form-input" type="tel" placeholder="9876543210"
              value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
              id="reg-phone" />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: "relative" }}>
              <input className="form-input" type={showPass ? "text" : "password"}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                required style={{ paddingRight: 44 }} id="reg-password" />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{
                position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
              }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {/* Live requirement indicators */}
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              {[
                { label: "8+ chars",   ok: form.password.length >= 8 },
                { label: "Uppercase",  ok: /[A-Z]/.test(form.password) },
                { label: "Number",     ok: /[0-9]/.test(form.password) },
              ].map(({ label, ok }) => (
                <span key={label} style={{
                  fontSize: 11, fontWeight: 600,
                  color: ok ? "#10b981" : form.password.length > 0 ? "#ef4444" : "var(--text-muted)",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  {ok ? "✓" : "✗"} {label}
                </span>
              ))}
            </div>
            {fieldErrors.password && (
              <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>
                {fieldErrors.password.join(", ")}
              </p>
            )}
          </div>

          <div style={{
            background: "var(--accent-glow)",
            border: "1px solid rgba(59,130,246,0.2)",
            borderRadius: 10, padding: "10px 14px",
            fontSize: 12, color: "var(--text-secondary)"
          }}>
            ✅ A <strong style={{ color: "var(--accent)" }}>free checking account</strong> will be automatically created for you.
          </div>

          <button type="submit" className="btn-primary" disabled={loading} id="reg-submit" style={{ width: "100%" }}>
            {loading ? <span className="spinner" /> : "Create Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
