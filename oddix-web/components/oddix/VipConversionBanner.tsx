"use client";

import type { CSSProperties } from "react";

export default function VipConversionBanner({
  plan,
  liveGames,
  topTips,
  onUpgrade,
}: {
  plan: string;
  liveGames: number;
  topTips: number;
  onUpgrade: () => void;
}) {
  const paid = ["PRO", "VIP", "Pro", "Vip", "pro", "vip"].includes(String(plan));

  if (paid) {
    return (
      <section style={styles.paidBanner}>
        <div>
          <span style={styles.kicker}>💎 ACESSO LIBERADO</span>
          <strong>Você está no plano {plan}</strong>
          <p>Use as análises, mercados inteligentes e o Oddix Boost para filtrar melhores entradas.</p>
        </div>

        <div style={styles.stats}>
          <span>{liveGames} ao vivo</span>
          <span>{topTips} entradas IA</span>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.banner}>
      <div>
        <span style={styles.kicker}>🔒 CONVERSÃO PRO/VIP</span>
        <h2>Free acompanha os jogos. PRO e VIP liberam análise completa.</h2>
        <p>
          Veja odds, jogos e ranking. Para acessar IA Premium, Player Props,
          Oddix Boost e análise detalhada, assine PRO ou VIP.
        </p>
      </div>

      <div style={styles.actions}>
        <div style={styles.benefits}>
          <span>🤖 IA Premium</span>
          <span>🎯 Player Props</span>
          <span>💎 Oddix Boost</span>
          <span>📲 Grupo VIP + mentoria</span>
        </div>

        <button style={styles.button} onClick={onUpgrade}>
          Liberar análise
        </button>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  banner: {
    margin: "18px 26px",
    background: "linear-gradient(135deg,#111827,#4c1d95,#7c3aed)",
    color: "#fff",
    borderRadius: 28,
    padding: 22,
    display: "grid",
    gridTemplateColumns: "1.2fr .8fr",
    gap: 18,
    alignItems: "center",
    border: "1px solid rgba(255,255,255,.14)",
    boxShadow: "0 18px 42px rgba(76,29,149,.22)",
  },
  paidBanner: {
    margin: "18px 26px",
    background: "linear-gradient(135deg,#052e16,#166534)",
    color: "#fff",
    borderRadius: 24,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    border: "1px solid rgba(34,197,94,.25)",
  },
  kicker: {
    color: "#facc15",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 1,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  benefits: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 9,
  },
  button: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 16,
    padding: "14px 18px",
    fontWeight: 900,
    cursor: "pointer",
  },
  stats: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
};
