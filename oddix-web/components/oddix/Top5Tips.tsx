"use client";

import type { CSSProperties } from "react";

export default function Top5Tips({
  tips,
  onOpen,
}: {
  tips: any[];
  onOpen: (tip: any) => void;
}) {
  const safeTips = Array.isArray(tips) ? tips.slice(0, 5) : [];

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <span style={styles.kicker}>🔥 TOP PICKS ODDIX AI</span>
          <h2 style={styles.title}>Ranking de maior confiança</h2>
        </div>

        <span style={styles.badge}>Oddix Score</span>
      </div>

      {safeTips.length ? (
        <div style={styles.list}>
          {safeTips.map((tip, index) => (
            <button
              key={`${tip.fixtureId || index}-${tip.tip}`}
              style={index === 0 ? styles.rowFeatured : styles.row}
              onClick={() => onOpen(tip)}
            >
              <span style={styles.rank}>{index + 1}</span>

              <div style={styles.info}>
                <strong>{tip.tip || "Entrada inteligente"}</strong>
                <small>{tip.game || "Jogo"} • {tip.market || "Mercado"}</small>
              </div>

              <div style={styles.metrics}>
                <strong>{Number(tip.confidence || 0)}%</strong>
                <small>Odd {tip.odd || "-"}</small>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div style={styles.empty}>
          Aguardando jogos com qualidade suficiente para montar os Top Picks.
        </div>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "linear-gradient(145deg,#111827,#312e81,#581c87)",
    color: "#fff",
    borderRadius: 28,
    padding: 20,
    border: "1px solid rgba(255,255,255,.16)",
    boxShadow: "0 18px 45px rgba(76,29,149,.20)",
    minHeight: 340,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  kicker: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: 1,
  },
  title: {
    margin: "6px 0 0",
    fontSize: 24,
  },
  badge: {
    background: "rgba(250,204,21,.16)",
    border: "1px solid rgba(250,204,21,.32)",
    color: "#facc15",
    borderRadius: 999,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },
  list: {
    display: "grid",
    gap: 10,
  },
  row: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "42px 1fr auto",
    alignItems: "center",
    gap: 12,
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.12)",
    color: "#fff",
    borderRadius: 18,
    padding: 12,
    cursor: "pointer",
    textAlign: "left",
  },
  rowFeatured: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "42px 1fr auto",
    alignItems: "center",
    gap: 12,
    background: "linear-gradient(135deg,rgba(34,197,94,.22),rgba(250,204,21,.16))",
    border: "1px solid rgba(34,197,94,.36)",
    color: "#fff",
    borderRadius: 18,
    padding: 12,
    cursor: "pointer",
    textAlign: "left",
  },
  rank: {
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "rgba(255,255,255,.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 1000,
  },
  info: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  metrics: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
    color: "#dcfce7",
  },
  empty: {
    background: "rgba(255,255,255,.08)",
    border: "1px dashed rgba(255,255,255,.20)",
    borderRadius: 18,
    padding: 18,
    color: "#ddd6fe",
  },
};
