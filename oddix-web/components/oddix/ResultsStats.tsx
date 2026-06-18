"use client";

import type { CSSProperties } from "react";

export default function ResultsStats({
  totalBets = 0,
  wonBets = 0,
  lostBets = 0,
  roi = 0,
  recent = [],
}: {
  totalBets?: number;
  wonBets?: number;
  lostBets?: number;
  roi?: number;
  recent?: any[];
}) {
  const finished = wonBets + lostBets;
  const hitRate = finished ? Math.round((wonBets / finished) * 100) : 0;

  return (
    <section style={styles.card} className="oddix-v35-results">
      <div style={styles.header}>
        <div>
          <span style={styles.kicker}>📊 RESULTADOS REAIS</span>
          <h2 style={styles.title}>Performance da plataforma</h2>
        </div>
        <span style={styles.badge}>Atualizado pelo histórico</span>
      </div>

      <div style={styles.grid}>
        <Metric label="Greens" value={wonBets} tone="green" />
        <Metric label="Reds" value={lostBets} tone="red" />
        <Metric label="Assertividade" value={`${hitRate}%`} tone="yellow" />
        <Metric label="ROI" value={`${roi || 0}%`} tone="purple" />
      </div>

      <div style={styles.footer}>
        <strong>{totalBets || 0}</strong>
        <span>análises registradas no histórico Oddix.</span>
      </div>

      {recent?.length ? (
        <div style={styles.recentList}>
          {recent.slice(0, 5).map((bet, index) => {
            const status = String(bet?.status || "").toLowerCase();
            const green = status === "won";
            return (
              <div key={bet?.id || index} style={styles.recentRow}>
                <span style={green ? styles.greenDot : styles.redDot}>{green ? "GREEN" : "RED"}</span>
                <strong>{bet?.homeTeam || "Casa"} x {bet?.awayTeam || "Fora"}</strong>
                <small>{bet?.tip || "Análise Oddix"}</small>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: "green" | "red" | "yellow" | "purple" }) {
  const toneStyle = {
    green: styles.metricGreen,
    red: styles.metricRed,
    yellow: styles.metricYellow,
    purple: styles.metricPurple,
  }[tone];

  return (
    <div style={{ ...styles.metric, ...toneStyle }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "#fff",
    color: "#111827",
    borderRadius: 28,
    padding: 22,
    border: "1px solid #e5e7eb",
    boxShadow: "0 18px 45px rgba(17,24,39,.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 18,
  },
  kicker: {
    color: "#7c3aed",
    fontWeight: 1000,
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    margin: "6px 0 0",
    fontSize: 26,
  },
  badge: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "8px 10px",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
    gap: 12,
  },
  metric: {
    borderRadius: 20,
    padding: 16,
    minHeight: 105,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  metricGreen: { background: "#dcfce7", color: "#14532d" },
  metricRed: { background: "#fee2e2", color: "#7f1d1d" },
  metricYellow: { background: "#fef9c3", color: "#713f12" },
  metricPurple: { background: "#ede9fe", color: "#4c1d95" },
  footer: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginTop: 16,
    color: "#64748b",
  },
  recentList: {
    display: "grid",
    gap: 8,
    marginTop: 16,
  },
  recentRow: {
    display: "grid",
    gridTemplateColumns: "86px 1fr 1fr",
    gap: 10,
    alignItems: "center",
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 12,
  },
  greenDot: {
    background: "#22c55e",
    color: "#fff",
    borderRadius: 999,
    padding: "6px 9px",
    fontWeight: 1000,
    fontSize: 11,
    textAlign: "center",
  },
  redDot: {
    background: "#ef4444",
    color: "#fff",
    borderRadius: 999,
    padding: "6px 9px",
    fontWeight: 1000,
    fontSize: 11,
    textAlign: "center",
  },
};
