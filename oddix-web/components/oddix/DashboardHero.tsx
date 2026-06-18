"use client";

import type { CSSProperties } from "react";

const ODDIX_PLAYER_IMAGE = "/images/oddix-player.png";

export default function DashboardHero({
  plan = "Free",
  liveGames = 0,
  topTips = 0,
  roi = 0,
  onUpgrade,
  onExplore,
}: {
  plan?: string;
  liveGames?: number;
  topTips?: number;
  roi?: number;
  onUpgrade: () => void;
  onExplore: () => void;
}) {
  return (
    <section style={styles.hero} className="oddix-v35-hero">
      <div style={styles.content}>
        <span style={styles.kicker}>ODDIX AI • Sports Intelligence</span>
        <h1 style={styles.title}>Análises esportivas com Inteligência Artificial.</h1>
        <p style={styles.text}>
          Odds reais, estatísticas avançadas, Top Picks, Player Props e filtros premium em uma plataforma única.
        </p>

        <div style={styles.badges}>
          <span>✓ Odds reais</span>
          <span>✓ Player Props</span>
          <span>✓ Top Picks</span>
          <span>✓ Estatísticas avançadas</span>
        </div>

        <div style={styles.actions}>
          <button style={styles.primary} onClick={onExplore}>Ver análises</button>
          <button style={styles.secondary} onClick={onUpgrade}>Desbloquear VIP</button>
        </div>
      </div>

      <div style={styles.visual}>
        <div style={styles.metrics}>
          <div style={styles.metric}>
            <span>Ao vivo</span>
            <strong>{liveGames}</strong>
          </div>
          <div style={styles.metric}>
            <span>Top Picks</span>
            <strong>{topTips}</strong>
          </div>
          <div style={styles.metric}>
            <span>ROI</span>
            <strong>{roi || 0}%</strong>
          </div>
        </div>

        <img style={styles.player} src={ODDIX_PLAYER_IMAGE} alt="Oddix AI Player" />
        <div style={styles.planPill}>Plano {plan}</div>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "minmax(0,1.05fr) minmax(280px,.95fr)",
    gap: 22,
    alignItems: "center",
    minHeight: 420,
    borderRadius: 34,
    padding: "34px clamp(20px,3vw,42px)",
    color: "#fff",
    background:
      "radial-gradient(circle at 72% 15%,rgba(250,204,21,.26),transparent 28%),radial-gradient(circle at 12% 4%,rgba(124,58,237,.36),transparent 35%),linear-gradient(135deg,#07070d,#111827 48%,#3b0764)",
    border: "1px solid rgba(255,255,255,.12)",
    boxShadow: "0 30px 90px rgba(0,0,0,.42)",
  },
  content: {
    position: "relative",
    zIndex: 2,
  },
  kicker: {
    display: "inline-flex",
    color: "#facc15",
    background: "rgba(250,204,21,.12)",
    border: "1px solid rgba(250,204,21,.22)",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: 1,
  },
  title: {
    margin: "18px 0 12px",
    fontSize: "clamp(38px,5vw,68px)",
    lineHeight: .92,
    letterSpacing: -2,
  },
  text: {
    maxWidth: 650,
    color: "#dbeafe",
    fontSize: "clamp(15px,1.2vw,18px)",
    lineHeight: 1.6,
  },
  badges: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 24,
  },
  primary: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 16,
    padding: "14px 20px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  secondary: {
    background: "rgba(255,255,255,.10)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: 16,
    padding: "14px 20px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  visual: {
    position: "relative",
    zIndex: 2,
    minHeight: 360,
  },
  metrics: {
    position: "absolute",
    top: 0,
    right: 0,
    display: "grid",
    gap: 10,
    zIndex: 3,
  },
  metric: {
    minWidth: 118,
    background: "rgba(255,255,255,.10)",
    border: "1px solid rgba(255,255,255,.14)",
    backdropFilter: "blur(10px)",
    borderRadius: 18,
    padding: 12,
  },
  player: {
    position: "absolute",
    right: "6%",
    bottom: -38,
    width: "min(420px,92%)",
    maxHeight: 440,
    objectFit: "contain",
    filter: "drop-shadow(0 28px 45px rgba(0,0,0,.55))",
  },
  planPill: {
    position: "absolute",
    left: 0,
    bottom: 18,
    background: "rgba(34,197,94,.16)",
    color: "#bbf7d0",
    border: "1px solid rgba(34,197,94,.30)",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 1000,
  },
};
