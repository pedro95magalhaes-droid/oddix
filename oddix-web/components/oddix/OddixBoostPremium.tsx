"use client";

import type { CSSProperties } from "react";

export default function OddixBoostPremium({
  picks,
  combinedOdd,
  confidence,
  isPaidPlan,
  onUpgrade,
  onOpen,
}: {
  picks: any[];
  combinedOdd: string;
  confidence: number;
  isPaidPlan: boolean;
  onUpgrade: () => void;
  onOpen: (tip: any) => void;
}) {
  const safePicks = Array.isArray(picks) ? picks : [];

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <span style={styles.kicker}>💎 ODDIX BOOST</span>
          <h2 style={styles.title}>Combinação otimizada pela IA</h2>
        </div>

        <div style={styles.oddBox}>
          <span>Odd</span>
          <strong>{safePicks.length ? combinedOdd : "0.00"}</strong>
        </div>
      </div>

      <div style={styles.confidence}>
        <span>Confiança média</span>
        <strong>{confidence || 0}%</strong>
      </div>

      <div style={styles.bar}>
        <div style={{ ...styles.fill, width: `${Math.min(100, confidence || 0)}%` }} />
      </div>

      {safePicks.length ? (
        <div style={styles.picks}>
          {safePicks.map((pick, index) => (
            <button key={`${pick.fixtureId || index}-${pick.tip}`} style={styles.pick} onClick={() => onOpen(pick)}>
              <span>{index + 1}</span>
              <div>
                <strong>{pick.tip}</strong>
                <small>{pick.game} • Odd {pick.odd}</small>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div style={styles.empty}>
          Aguardando entradas com confiança alta e odd protegida.
        </div>
      )}

      {!isPaidPlan && (
        <button style={styles.lockButton} onClick={onUpgrade}>
          🔒 Desbloquear Boost completo
        </button>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "white",
    color: "#111827",
    borderRadius: 28,
    padding: 20,
    border: "1px solid #ede9fe",
    boxShadow: "0 18px 45px rgba(17,24,39,.08)",
    minHeight: 340,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 12,
  },
  kicker: {
    color: "#7c3aed",
    fontWeight: 1000,
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    margin: "6px 0 0",
    fontSize: 24,
  },
  oddBox: {
    minWidth: 90,
    background: "#111827",
    color: "#fff",
    borderRadius: 18,
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  confidence: {
    display: "flex",
    justifyContent: "space-between",
    color: "#6b7280",
    fontWeight: 900,
    marginBottom: 8,
  },
  bar: {
    height: 9,
    background: "#ede9fe",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 14,
  },
  fill: {
    height: "100%",
    background: "linear-gradient(90deg,#22c55e,#facc15)",
  },
  picks: {
    display: "grid",
    gap: 10,
  },
  pick: {
    display: "grid",
    gridTemplateColumns: "34px 1fr",
    gap: 10,
    alignItems: "center",
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: 16,
    padding: 12,
    cursor: "pointer",
    textAlign: "left",
  },
  empty: {
    background: "#f8fafc",
    border: "1px dashed #c4b5fd",
    borderRadius: 16,
    padding: 14,
    color: "#6b7280",
  },
  lockButton: {
    width: "100%",
    marginTop: 14,
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 15,
    padding: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },
};
