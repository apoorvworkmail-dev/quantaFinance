import React, { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../context/ToastContext";
import api from "../api/client";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet,
  PiggyBank, ArrowUpRight, ArrowDownLeft,
  Activity,
} from "lucide-react";

/* ── types ── */
interface Summary {
  totalBalance: number; totalIn: number; totalOut: number;
  savingsRate: number; txCount: number; accountCount: number;
}
interface MonthlyPoint { month: string; income: number; expense: number; }
interface BreakdownPoint { name: string; value: number; }
interface ActivityPoint { date: string; net: number; }

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#818cf8"];

/* ── custom tooltip ── */
const CurrencyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#111827", border: "1px solid #1e2d45",
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
    }}>
      <p style={{ color: "#94a3b8", marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: ${Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const NetTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div style={{
      background: "#111827", border: "1px solid #1e2d45",
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
    }}>
      <p style={{ color: "#94a3b8", marginBottom: 4 }}>{label}</p>
      <p style={{ color: val >= 0 ? "#10b981" : "#ef4444", fontWeight: 700, fontSize: 14 }}>
        {val >= 0 ? "+" : ""}${Math.abs(val).toLocaleString()}
      </p>
    </div>
  );
};

/* ── StatCard ── */
const StatCard = ({
  icon, label, value, sub, color, trend,
}: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; color: string; trend?: "up" | "down" | "neutral";
}) => (
  <div className="glass-card" style={{ padding: 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: color + "22",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 14,
      }}>
        {icon}
      </div>
      {trend && (
        <div style={{
          display: "flex", alignItems: "center", gap: 3, fontSize: 11,
          color: trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#94a3b8",
          background: trend === "up" ? "rgba(16,185,129,0.1)" : trend === "down" ? "rgba(239,68,68,0.1)" : "transparent",
          padding: "3px 8px", borderRadius: 20,
        }}>
          {trend === "up" ? <TrendingUp size={11} /> : trend === "down" ? <TrendingDown size={11} /> : null}
        </div>
      )}
    </div>
    <div className="stat-value" style={{ fontSize: 24, marginBottom: 4 }}>{value}</div>
    <div className="stat-label">{label}</div>
    {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
  </div>
);

export const AnalyticsPage = () => {
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownPoint[]>([]);
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [s, m, b, a] = await Promise.all([
          api.get("/analytics/summary"),
          api.get("/analytics/monthly"),
          api.get("/analytics/breakdown"),
          api.get("/analytics/recent-activity"),
        ]);
        setSummary(s.data.data);
        setMonthly(m.data.data.monthly);
        setBreakdown(b.data.data.breakdown);
        setActivity(a.data.data.activity);
      } catch {
        toast.error("Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const fmt = (n: number) =>
    n >= 1000
      ? "$" + (n / 1000).toFixed(1) + "k"
      : "$" + n.toLocaleString();

  const hasActivity = activity.some(d => d.net !== 0);
  const hasMonthly  = monthly.some(d => d.income > 0 || d.expense > 0);
  const hasBreakdown = breakdown.length > 0;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">

        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Your financial insights and spending patterns</p>
        </div>

        {/* ── Summary Cards ───────────────────────────────── */}
        {loading ? (
          <div className="grid-4" style={{ marginBottom: 28 }}>
            {[1,2,3,4].map(i => (
              <div key={i} className="glass-card" style={{ padding: 24 }}>
                <Skeleton width={44} height={44} borderRadius={12} style={{ marginBottom: 14 }} />
                <Skeleton width="60%" height={28} borderRadius={8} style={{ marginBottom: 8 }} />
                <Skeleton width="80%" height={14} borderRadius={6} />
              </div>
            ))}
          </div>
        ) : summary && (
          <div className="grid-4" style={{ marginBottom: 28 }}>
            <StatCard
              icon={<Wallet size={20} color="#3b82f6" />}
              label="Total Balance" color="#3b82f6"
              value={fmt(summary.totalBalance)}
              sub={`Across ${summary.accountCount} account${summary.accountCount !== 1 ? "s" : ""}`}
              trend="neutral"
            />
            <StatCard
              icon={<ArrowDownLeft size={20} color="#10b981" />}
              label="Total Income" color="#10b981"
              value={fmt(summary.totalIn)}
              sub="All deposits & incoming transfers"
              trend="up"
            />
            <StatCard
              icon={<ArrowUpRight size={20} color="#ef4444" />}
              label="Total Spent" color="#ef4444"
              value={fmt(summary.totalOut)}
              sub="All outgoing transfers"
              trend="down"
            />
            <StatCard
              icon={<PiggyBank size={20} color="#f59e0b" />}
              label="Savings Rate" color="#f59e0b"
              value={`${summary.savingsRate}%`}
              sub={`${summary.txCount} total transaction${summary.txCount !== 1 ? "s" : ""}`}
              trend={summary.savingsRate >= 20 ? "up" : "neutral"}
            />
          </div>
        )}

        {/* ── Income vs Expense Bar Chart ─────────────────── */}
        <div className="grid-2" style={{ gap: 24, marginBottom: 24 }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Activity size={18} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Income vs Expense</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Last 6 months</div>
              </div>
            </div>

            {loading ? (
              <Skeleton height={200} borderRadius={12} />
            ) : !hasMonthly ? (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No transaction data yet — make some deposits or transfers!
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthly} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                  <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => "$" + (v >= 1000 ? (v/1000).toFixed(0)+"k" : v)} tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[6,6,0,0]} />
                  <Bar dataKey="expense" name="Expense" fill="#3b82f6" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Transaction Breakdown Pie ──────────────────── */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PiggyBank size={18} color="var(--warning)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Transaction Breakdown</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>By type — all time</div>
              </div>
            </div>

            {loading ? (
              <Skeleton height={200} borderRadius={12} />
            ) : !hasBreakdown ? (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No data yet
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie
                      data={breakdown} cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      paddingAngle={3} dataKey="value"
                    >
                      {breakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, ""]} contentStyle={{ background: "#111827", border: "1px solid #1e2d45", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  {breakdown.map((b, i) => {
                    const total = breakdown.reduce((s, x) => s + x.value, 0);
                    const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
                    return (
                      <div key={b.name}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                            <span style={{ color: "var(--text-secondary)" }}>{b.name}</span>
                          </div>
                          <span style={{ fontWeight: 600 }}>{pct}%</span>
                        </div>
                        <div className="progress-bar-wrap">
                          <div className="progress-bar" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 14-Day Net Activity Area Chart ──────────────── */}
        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(129,140,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={18} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>14-Day Net Cash Flow</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Daily money in minus money out</div>
            </div>
          </div>

          {loading ? (
            <Skeleton height={180} borderRadius={12} />
          ) : !hasActivity ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No activity in the last 14 days — start transacting to see your cash flow!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={activity}>
                <defs>
                  <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => (v >= 0 ? "+" : "") + "$" + Math.abs(v)} tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<NetTooltip />} />
                <Area
                  type="monotone" dataKey="net" name="Net"
                  stroke="#818cf8" strokeWidth={2}
                  fill="url(#netGradient)"
                  dot={{ fill: "#818cf8", r: 3 }}
                  activeDot={{ r: 5, fill: "#818cf8" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Savings Rate Card ────────────────────────────── */}
        {!loading && summary && (
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Savings Health</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>How much you keep vs spend</div>
              </div>
              <span style={{
                fontSize: 22, fontWeight: 800,
                color: summary.savingsRate >= 20 ? "var(--success)" : summary.savingsRate >= 10 ? "var(--warning)" : "var(--danger)",
              }}>
                {summary.savingsRate}%
              </span>
            </div>

            <div className="progress-bar-wrap" style={{ height: 10, marginBottom: 12 }}>
              <div className="progress-bar" style={{
                width: `${Math.min(summary.savingsRate, 100)}%`,
                background: summary.savingsRate >= 20
                  ? "linear-gradient(90deg,#10b981,#059669)"
                  : summary.savingsRate >= 10
                    ? "linear-gradient(90deg,#f59e0b,#d97706)"
                    : "linear-gradient(90deg,#ef4444,#dc2626)",
              }} />
            </div>

            <div style={{ display: "flex", gap: 24 }}>
              {[
                { label: "Poor", range: "< 10%", color: "var(--danger)" },
                { label: "Fair", range: "10–20%", color: "var(--warning)" },
                { label: "Good", range: "> 20%", color: "var(--success)" },
              ].map(({ label, range, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                  <span style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{range}</span>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 16, padding: "12px 16px",
              background: summary.savingsRate >= 20 ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
              border: `1px solid ${summary.savingsRate >= 20 ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
              borderRadius: 10, fontSize: 13, color: "var(--text-secondary)",
            }}>
              {summary.savingsRate >= 20
                ? "🎉 Excellent! You're saving over 20% of your income. Keep it up!"
                : summary.savingsRate >= 10
                  ? "📈 You're on the right track. Try to reduce outgoing transfers to reach 20%."
                  : summary.txCount === 0
                    ? "💡 Start depositing and transferring money to see your savings insights."
                    : "⚠️ Your expenses exceed income. Review your outgoing transfers."}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
