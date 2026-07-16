import React, { useState, useRef, useEffect } from "react";
import api from "../api/client";
import { MessageSquare, Send, X, Bot, User, Sparkles, CornerDownLeft } from "lucide-react";
import { useToast } from "../context/ToastContext";

interface Message {
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
}

export const AIChatBot = () => {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hello! I am QuantaBot, your AI financial banking advisor. I can analyze your transactions, check your account balances, or suggest savings rules. Ask me anything!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    "Analyze my balance",
    "Show recent transactions",
    "Suggest a budget plan",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { sender: "user", text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/analytics/chat", {
        message: text,
        history: messages.slice(-10), // send last 10 messages for context retention
      });

      const botMsg: Message = {
        sender: "bot",
        text: res.data.data.reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      toast.error("Failed to connect to QuantaBot.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="floating-bot-trigger"
        title="Chat with QuantaBot"
        style={{
          position: "fixed", bottom: 24, right: 24,
          background: "linear-gradient(135deg, #3b82f6, #818cf8)",
          border: "none", width: 56, height: 56, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", cursor: "pointer", zIndex: 1000,
          boxShadow: "0 8px 30px rgba(59, 130, 246, 0.4)",
          transition: "transform 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Sparkles size={24} />
      </button>
    );
  }

  return (
    <div
      className="glass-card chatbot-window fade-in"
      style={{
        position: "fixed", bottom: 24, right: 24,
        width: 380, height: 520, zIndex: 1000,
        display: "flex", flexDirection: "column",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        border: "1px solid var(--border-light)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #3b82f6, #818cf8)",
          padding: "16px 20px", display: "flex", justifyContent: "space-between",
          alignItems: "center", color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>QuantaBot</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)" }}>AI Financial Assistant</div>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "white", display: "flex" }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1, padding: 20, overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              display: "flex", gap: 8,
              flexDirection: msg.sender === "user" ? "row-reverse" : "row",
            }}
          >
            <div
              style={{
                width: 24, height: 24, borderRadius: "50%",
                background: msg.sender === "user" ? "var(--accent)" : "var(--bg-secondary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginTop: 4,
              }}
            >
              {msg.sender === "user" ? <User size={12} color="white" /> : <Bot size={12} color="var(--accent)" />}
            </div>
            <div
              style={{
                background: msg.sender === "user" ? "var(--accent)" : "var(--bg-secondary)",
                color: "var(--text-primary)",
                padding: "10px 14px", borderRadius: 12,
                fontSize: 13, lineHeight: 1.5,
                whiteSpace: "pre-line",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", display: "flex", gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "var(--bg-secondary)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot size={12} color="var(--accent)" />
            </div>
            <div style={{ background: "var(--bg-secondary)", padding: "12px 16px", borderRadius: 12 }}>
              <span className="spinner" style={{ width: 12, height: 12 }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length === 1 && (
        <div style={{ display: "flex", gap: 8, padding: "0 20px 14px", flexWrap: "wrap" }}>
          {quickPrompts.map(p => (
            <button
              key={p}
              onClick={() => handleSend(p)}
              style={{
                background: "var(--bg-secondary)", border: "1px solid var(--border)",
                borderRadius: 20, padding: "6px 12px", fontSize: 11,
                color: "var(--text-secondary)", cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSend(input);
        }}
        style={{
          padding: 16, borderTop: "1px solid var(--border)",
          display: "flex", gap: 8, alignItems: "center",
        }}
      >
        <input
          className="form-input"
          placeholder="Ask QuantaBot a question..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
          style={{ flex: 1, padding: "10px 14px" }}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !input.trim()}
          style={{ width: 38, height: 38, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};
