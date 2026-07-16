import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

const shimmer = `
  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position: 600px 0; }
  }
`;

const skeletonStyle = (w: string | number = "100%", h: string | number = 16, r: string | number = 8): React.CSSProperties => ({
  width: w,
  height: h,
  borderRadius: r,
  background: "linear-gradient(90deg, #1a2235 25%, #243352 50%, #1a2235 75%)",
  backgroundSize: "600px 100%",
  animation: "shimmer 1.4s infinite linear",
  display: "block",
  flexShrink: 0,
});

export const Skeleton = ({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonProps) => (
  <>
    <style>{shimmer}</style>
    <div style={{ ...skeletonStyle(width, height, borderRadius), ...style }} />
  </>
);

// Preset skeletons for common UI patterns
export const StatCardSkeleton = () => (
  <div className="stat-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <Skeleton width={44} height={44} borderRadius={12} />
    <Skeleton width="60%" height={28} borderRadius={6} />
    <Skeleton width="40%" height={13} borderRadius={6} />
  </div>
);

export const TableRowSkeleton = ({ cols = 5 }: { cols?: number }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: "16px 16px" }}>
        <Skeleton height={14} borderRadius={6} width={i === 0 ? "80%" : i === 1 ? "60%" : "70%"} />
      </td>
    ))}
  </tr>
);

export const AccountCardSkeleton = () => (
  <div className="glass-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <Skeleton width={80} height={22} borderRadius={20} />
      <Skeleton width={60} height={22} borderRadius={20} />
    </div>
    <Skeleton width="70%" height={32} borderRadius={8} />
    <Skeleton width="50%" height={13} borderRadius={6} />
    <div style={{ height: 1, background: "var(--border)" }} />
    <div style={{ display: "flex", gap: 10 }}>
      <Skeleton height={36} borderRadius={10} />
      <Skeleton width={80} height={36} borderRadius={10} />
    </div>
  </div>
);

export const CardSkeleton = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{
      background: "linear-gradient(135deg, #1a2235, #0f1628)",
      borderRadius: 20, padding: 28, minHeight: 190,
      border: "1px solid var(--border)",
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      <Skeleton width={40} height={30} borderRadius={6} style={{ background: "linear-gradient(90deg, #243352 25%, #2d3f5e 50%, #243352 75%)", backgroundSize: "600px 100%" }} />
      <Skeleton width="75%" height={18} borderRadius={6} style={{ background: "linear-gradient(90deg, #243352 25%, #2d3f5e 50%, #243352 75%)", backgroundSize: "600px 100%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto" }}>
        <Skeleton width={80} height={14} borderRadius={6} style={{ background: "linear-gradient(90deg, #243352 25%, #2d3f5e 50%, #243352 75%)", backgroundSize: "600px 100%" }} />
        <Skeleton width={40} height={14} borderRadius={6} style={{ background: "linear-gradient(90deg, #243352 25%, #2d3f5e 50%, #243352 75%)", backgroundSize: "600px 100%" }} />
      </div>
    </div>
    <div className="glass-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <Skeleton width="60%" height={20} borderRadius={6} />
      <Skeleton width="40%" height={13} borderRadius={6} />
      <Skeleton height={36} borderRadius={10} style={{ marginTop: 6 }} />
    </div>
  </div>
);
