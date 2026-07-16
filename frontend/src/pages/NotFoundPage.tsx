import React from "react";
import { useNavigate } from "react-router-dom";
import { Landmark, Home, ArrowLeft } from "lucide-react";

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-primary)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute",
        width: 500, height: 500,
        background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }} />

      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }} className="fade-in">
        {/* Logo */}
        <div style={{
          width: 64, height: 64,
          background: "linear-gradient(135deg, #3b82f6, #818cf8)",
          borderRadius: 18,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
          boxShadow: "0 0 40px rgba(59,130,246,0.3)",
        }}>
          <Landmark size={30} color="white" />
        </div>

        {/* 404 number */}
        <div style={{
          fontSize: 120,
          fontWeight: 900,
          letterSpacing: -8,
          lineHeight: 1,
          background: "linear-gradient(135deg, #1e3a5f, #243352)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: 8,
          userSelect: "none",
        }}>
          404
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
          Page Not Found
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 360, margin: "0 auto 32px" }}>
          The page you're looking for doesn't exist or you don't have permission to access it.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="btn-ghost" onClick={() => navigate(-1)}
            style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ArrowLeft size={15} /> Go Back
          </button>
          <button className="btn-primary" onClick={() => navigate("/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Home size={15} /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
