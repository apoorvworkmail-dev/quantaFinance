import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, Send, X, Bot, User, Sparkles, Zap, Copy, Check, ChevronDown } from "lucide-react";
import { useToast } from "../context/ToastContext";

interface Message {
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
  streaming?: boolean;
  isLive?: boolean;
}

/* ── Lightweight inline markdown renderer ────────────────────────── */
const renderMarkdown = (text: string): React.ReactNode[] => {
  const lines = text.split("\n");
  return lines.map((line, li) => {
    // bullet
    if (/^[-•*]\s/.test(line)) {
      return (
        <div key={li} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
          <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }}>•</span>
          <span>{inlineStyle(line.replace(/^[-•*]\s/, ""))}</span>
        </div>
      );
    }
    // heading
    if (/^#{1,3}\s/.test(line)) {
      const txt = line.replace(/^#{1,3}\s/, "");
      return <div key={li} style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, marginTop: li > 0 ? 8 : 0 }}>{inlineStyle(txt)}</div>;
    }
    // blank line = spacer
    if (!line.trim()) return <div key={li} style={{ height: 6 }} />;
    return <div key={li} style={{ marginBottom: 2 }}>{inlineStyle(line)}</div>;
  });
};

const inlineStyle = (text: string): React.ReactNode => {
  // Split on **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*(.+)\*\*$/.test(part))
      return <strong key={i} style={{ color: "var(--text-primary)", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    if (/^\*(.+)\*$/.test(part))
      return <em key={i} style={{ color: "#a5b4fc" }}>{part.slice(1, -1)}</em>;
    if (/^`(.+)`$/.test(part))
      return <code key={i} style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", padding: "1px 5px", borderRadius: 4, fontSize: "0.88em", fontFamily: "monospace" }}>{part.slice(1, -1)}</code>;
    return part;
  });
};

/* ── Copy button ──────────────────────────────────────────────────── */
const CopyBtn = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={copy} title="Copy" style={{
      background: "none", border: "none", cursor: "pointer",
      color: copied ? "var(--success)" : "var(--text-muted)",
      padding: "2px 4px", borderRadius: 4, opacity: 0,
      transition: "all 0.15s", display: "flex", alignItems: "center",
    }}
      className="msg-copy-btn"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
};

/* ── Typing dots ─────────────────────────────────────────────────── */
const TypingDots = () => (
  <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 2px" }}>
    {[0, 1, 2].map(i => (
      <span key={i} style={{
        width: 6, height: 6, borderRadius: "50%",
        background: "var(--accent)", display: "block",
        animation: "dotBounce 1.2s ease-in-out infinite",
        animationDelay: `${i * 0.2}s`,
      }} />
    ))}
  </div>
);

const quickPrompts = [
  "💰 What's my balance?",
  "📊 Show recent transactions",
  "🎯 Suggest a savings plan",
  "🏦 Any active loans or FDs?",
];

export const AIChatBot = () => {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hello! I'm **QuantaBot**, your AI financial advisor powered by Gemini.\n\nI can analyze your **accounts**, **transactions**, **loans**, and **fixed deposits** in real time. How can I help you today?",
      timestamp: new Date(),
      isLive: false,
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollToBottom(false), 50);
      inputRef.current?.focus();
    }
  }, [isOpen, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 80);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || streaming) return;
    const token = localStorage.getItem("accessToken");
    if (!token) { toast.error("Please login to use QuantaBot."); return; }

    const userMsg: Message = { sender: "user", text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    // Placeholder bot message that we'll stream into
    const botPlaceholder: Message = { sender: "bot", text: "", timestamp: new Date(), streaming: true, isLive: false };
    setMessages(prev => [...prev, botPlaceholder]);

    let fullText = "";
    let isLive = false;
    let closed = false;

    const es = new EventSource(`http://localhost:5000/api/v1/analytics/chat/stream?_t=${Date.now()}`);
    // EventSource doesn't support POST — use fetch with ReadableStream instead
    es.close();

    const ctrl = new AbortController();
    abortRef.current = () => ctrl.abort();

    try {
      const res = await fetch("http://localhost:5000/api/v1/analytics/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10),
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const parsed = JSON.parse(line.slice(5).trim());
            if (parsed.error) { toast.error(parsed.error); closed = true; break; }
            if (parsed.chunk) {
              fullText += parsed.chunk;
              isLive = true;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  text: fullText,
                  streaming: true,
                  isLive: true,
                };
                return updated;
              });
            }
            if (parsed.done) { closed = true; break; }
          } catch { /* ignore malformed SSE lines */ }
        }
        if (closed) break;
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error("QuantaBot is unavailable. Please try again.");
        // Remove the empty placeholder
        setMessages(prev => prev.filter((_, i) => i < prev.length - 1));
      }
    } finally {
      // Mark message as done (remove streaming cursor)
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.sender === "bot") {
          updated[updated.length - 1] = { ...last, streaming: false, isLive: isLive };
        }
        return updated;
      });
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stopStream = () => {
    abortRef.current?.();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="Chat with QuantaBot"
        style={{
          position: "fixed", bottom: 24, right: 24,
          background: "linear-gradient(135deg, #3b82f6, #818cf8)",
          border: "none", width: 58, height: 58, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", cursor: "pointer", zIndex: 1000,
          boxShadow: "0 8px 32px rgba(59,130,246,0.45)",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(59,130,246,0.6)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(59,130,246,0.45)"; }}
      >
        <Sparkles size={24} />
        {/* Pulse ring */}
        <span style={{
          position: "absolute", inset: -4, borderRadius: "50%",
          border: "2px solid rgba(59,130,246,0.4)",
          animation: "pulseRing 2s ease-out infinite",
          pointerEvents: "none",
        }} />
      </button>
    );
  }

  return (
    <>
      <style>{`
        @keyframes dotBounce {
          0%,80%,100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes blinkCursor {
          0%,100% { opacity: 1; } 50% { opacity: 0; }
        }
        .msg-wrap:hover .msg-copy-btn { opacity: 1 !important; }
        .qp-btn:hover { border-color: var(--accent) !important; color: var(--accent) !important; background: var(--accent-glow) !important; }
      `}</style>

      <div
        className="fade-in"
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 400, height: 580, zIndex: 1000,
          display: "flex", flexDirection: "column",
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          borderRadius: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.1)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{
          background: "linear-gradient(135deg, #1e40af 0%, #4f46e5 100%)",
          padding: "14px 18px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.2)",
            }}>
              <Bot size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "white", letterSpacing: "-0.3px" }}>QuantaBot</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#10b981", display: "inline-block",
                  animation: "pulseRing 2s ease-out infinite",
                }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>
                  {streaming ? "Thinking…" : "Live AI · Gemini"}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{
              background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 20, padding: "3px 8px",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Zap size={10} color="#10b981" />
              <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700 }}>LIVE</span>
            </div>
            <button onClick={() => setIsOpen(false)} style={{
              background: "rgba(255,255,255,0.1)", border: "none",
              cursor: "pointer", color: "white",
              width: 28, height: 28, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Messages ─────────────────────────────────────────── */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{
            flex: 1, padding: "16px 14px",
            overflowY: "auto", display: "flex",
            flexDirection: "column", gap: 12,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className="msg-wrap"
              style={{
                alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                maxWidth: "88%",
                display: "flex", gap: 7,
                flexDirection: msg.sender === "user" ? "row-reverse" : "row",
                animation: "fadeIn 0.2s ease",
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                background: msg.sender === "user"
                  ? "linear-gradient(135deg,#3b82f6,#818cf8)"
                  : "var(--bg-secondary)",
                border: msg.sender === "bot" ? "1px solid var(--border-light)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {msg.sender === "user"
                  ? <User size={13} color="white" />
                  : <Bot size={13} color="var(--accent)" />}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: msg.sender === "user" ? "flex-end" : "flex-start" }}>
                {/* Bubble */}
                <div style={{
                  background: msg.sender === "user"
                    ? "linear-gradient(135deg,#3b82f6,#6366f1)"
                    : "var(--bg-secondary)",
                  border: msg.sender === "bot" ? "1px solid var(--border)" : "none",
                  padding: "10px 13px", borderRadius: 14,
                  fontSize: 13, lineHeight: 1.6,
                  color: "var(--text-primary)",
                  position: "relative",
                }}>
                  {/* If bot streaming and empty — show typing dots */}
                  {msg.sender === "bot" && msg.streaming && !msg.text ? (
                    <TypingDots />
                  ) : (
                    <>
                      {msg.sender === "bot"
                        ? renderMarkdown(msg.text)
                        : <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>}
                      {/* Blinking cursor while streaming */}
                      {msg.streaming && msg.text && (
                        <span style={{
                          display: "inline-block", width: 2, height: "1em",
                          background: "var(--accent)", marginLeft: 2,
                          verticalAlign: "text-bottom",
                          animation: "blinkCursor 0.7s step-end infinite",
                        }} />
                      )}
                    </>
                  )}
                </div>

                {/* Meta row */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {msg.sender === "bot" && msg.isLive && !msg.streaming && (
                    <span style={{
                      fontSize: 9, color: "#10b981", fontWeight: 700,
                      background: "rgba(16,185,129,0.1)", padding: "1px 5px", borderRadius: 10,
                    }}>
                      ⚡ LIVE AI
                    </span>
                  )}
                  {msg.text && <CopyBtn text={msg.text} />}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll-to-bottom btn */}
        {showScrollBtn && (
          <button onClick={() => scrollToBottom()} style={{
            position: "absolute", bottom: 88, right: 18,
            background: "var(--bg-card)", border: "1px solid var(--border-light)",
            borderRadius: "50%", width: 30, height: 30, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-secondary)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 2, transition: "all 0.15s",
          }}>
            <ChevronDown size={14} />
          </button>
        )}

        {/* ── Quick prompts ─────────────────────────────────────── */}
        {messages.length === 1 && (
          <div style={{
            display: "flex", gap: 6, padding: "0 14px 10px",
            flexWrap: "wrap", flexShrink: 0,
          }}>
            {quickPrompts.map(p => (
              <button
                key={p}
                className="qp-btn"
                onClick={() => handleSend(p)}
                disabled={streaming}
                style={{
                  background: "var(--bg-secondary)", border: "1px solid var(--border)",
                  borderRadius: 20, padding: "5px 11px", fontSize: 11,
                  color: "var(--text-secondary)", cursor: "pointer",
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* ── Input bar ─────────────────────────────────────────── */}
        <form
          onSubmit={e => { e.preventDefault(); handleSend(input); }}
          style={{
            padding: "10px 14px 14px",
            borderTop: "1px solid var(--border)",
            display: "flex", gap: 8, alignItems: "center",
            flexShrink: 0,
            background: "var(--bg-secondary)",
          }}
        >
          <input
            ref={inputRef}
            className="form-input"
            placeholder={streaming ? "QuantaBot is responding…" : "Ask QuantaBot anything…"}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={streaming}
            style={{ flex: 1, padding: "9px 13px", fontSize: 13, borderRadius: 12 }}
          />
          {streaming ? (
            <button
              type="button"
              onClick={stopStream}
              title="Stop"
              style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: "var(--danger-glow)", border: "1px solid rgba(239,68,68,0.3)",
                color: "var(--danger)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={15} />
            </button>
          ) : (
            <button
              type="submit"
              className="btn-primary"
              disabled={!input.trim()}
              style={{ width: 38, height: 38, padding: 0, flexShrink: 0, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Send size={15} />
            </button>
          )}
        </form>

        {/* Powered by */}
        <div style={{
          textAlign: "center", fontSize: 10, color: "var(--text-muted)",
          paddingBottom: 6, paddingTop: 4, background: "var(--bg-secondary)",
          flexShrink: 0,
        }}>
          Powered by <span style={{ color: "#818cf8", fontWeight: 600 }}>Google Gemini</span> · QuantaBank AI
        </div>
      </div>
    </>
  );
};
