import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const ICONS = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

const COLORS: Record<ToastType, { bg: string; border: string; color: string }> = {
  success: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", color: "#10b981" },
  error:   { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  color: "#ef4444" },
  warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", color: "#f59e0b" },
  info:    { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)", color: "#3b82f6" },
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = (id: string) =>
    setToasts(prev => prev.filter(t => t.id !== id));

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), 4000);
  }, []);

  const success = useCallback((msg: string) => toast(msg, "success"), [toast]);
  const error   = useCallback((msg: string) => toast(msg, "error"),   [toast]);
  const warning = useCallback((msg: string) => toast(msg, "warning"), [toast]);
  const info    = useCallback((msg: string) => toast(msg, "info"),    [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}

      {/* Toast Container */}
      <div style={{
        position: "fixed",
        bottom: 24, right: 24,
        display: "flex", flexDirection: "column", gap: 10,
        zIndex: 9999,
        maxWidth: 360,
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type];
          return (
            <div
              key={t.id}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 16px",
                background: "#111827",
                border: `1px solid ${c.border}`,
                borderLeft: `3px solid ${c.color}`,
                borderRadius: 12,
                boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
                animation: "slideIn 0.25s ease",
                cursor: "default",
              }}
            >
              <span style={{ color: c.color, marginTop: 1, flexShrink: 0 }}>{ICONS[t.type]}</span>
              <span style={{ fontSize: 13, color: "#f1f5f9", lineHeight: 1.5, flex: 1 }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#475569", padding: 0, display: "flex", flexShrink: 0,
                marginTop: 1,
              }}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
