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
    <section style={styles.hero} className="oddix-v35-hero oddix-v35-2-hero">
      <div style={styles.content}>
        <div style={styles.brandBlock}>
          <span style={styles.logoMark}>ODDIX AI</span>
          <span style={styles.platform}>Sports Intelligence Platform</span>
        </div>

        <h1 style={styles.title}>Análises esportivas com Inteligência Artificial.</h1>
        <p style={styles.text}>
          Plataforma premium com odds reais, estatísticas avançadas, Top Picks, Player Props e filtros inteligentes para decisões mais seguras.
        </p>

        <div style={styles.badges}>
          <span>✓ Odds Reais</span>
          <span>✓ IA Proprietária</span>
          <span>✓ Player Props Premium</span>
          <span>✓ Estatísticas Avançadas</span>
          <span>✓ Resultados Verificados</span>
          <span>✓ Plataforma Web Premium</span>
        </div>

        <div style={styles.actions}>
          <button style={styles.primary} onClick={onExplore}>Ver análises</button>
          <button style={styles.secondary} onClick={onUpgrade}>Desbloquear Plataforma VIP</button>
        </div>
      </div>

      <div style={styles.visual}>
        <div style={styles.metrics}>
          <Metric icon="📡" label="Jogos Ao Vivo" value={liveGames} />
          <Metric icon="🔥" label="Top Picks" value={topTips} />
          <Metric icon="📈" label="Assertividade" value={`${roi || 0}%`} />
          <Metric icon="🎯" label="Player Props" value="Premium" />
        </div>

        <img style={styles.player} src={ODDIX_PLAYER_IMAGE} alt="Oddix AI Player" />
        <div style={styles.planPill}>Plano {plan}</div>
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricIcon}>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "minmax(0,1.05fr) minmax(300px,.95fr)",
    gap: 22,
    alignItems: "center",
    minHeight: 460,
    borderRadius: 34,
    padding: "38px clamp(20px,3vw,46px)",
    color: "#fff",
    background:
      "radial-gradient(circle at 76% 15%,rgba(250,204,21,.30),transparent 28%),radial-gradient(circle at 12% 4%,rgba(124,58,237,.40),transparent 35%),linear-gradient(135deg,#07070d,#111827 48%,#3b0764)",
    border: "1px solid rgba(255,255,255,.13)",
    boxShadow: "0 30px 90px rgba(0,0,0,.44)",
  },
  content: { position: "relative", zIndex: 2 },
  brandBlock: { display: "grid", gap: 6, alignItems: "start" },
  logoMark: {
    display: "inline-flex",
    width: "fit-content",
    color: "#facc15",
    background: "rgba(250,204,21,.13)",
    border: "1px solid rgba(250,204,21,.28)",
    borderRadius: 18,
    padding: "10px 14px",
    fontSize: "clamp(22px,2.2vw,34px)",
    lineHeight: 1,
    fontWeight: 1000,
    letterSpacing: -0.7,
    boxShadow: "0 12px 34px rgba(250,204,21,.14)",
  },
  platform: { color: "#dbeafe", fontSize: 13, fontWeight: 1000, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { margin: "20px 0 12px", fontSize: "clamp(38px,5vw,70px)", lineHeight: .92, letterSpacing: -2 },
  text: { maxWidth: 690, color: "#dbeafe", fontSize: "clamp(15px,1.2vw,18px)", lineHeight: 1.6 },
  badges: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 },
  actions: { display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 },
  primary: { background: "#facc15", color: "#111827", border: 0, borderRadius: 16, padding: "14px 20px", fontWeight: 1000, cursor: "pointer" },
  secondary: { background: "rgba(255,255,255,.10)", color: "#fff", border: "1px solid rgba(255,255,255,.18)", borderRadius: 16, padding: "14px 20px", fontWeight: 1000, cursor: "pointer" },
  visual: { position: "relative", zIndex: 2, minHeight: 380 },
  metrics: { position: "absolute", top: 0, right: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, zIndex: 3, width: "min(310px,100%)" },
  metric: { background: "rgba(255,255,255,.105)", border: "1px solid rgba(255,255,255,.15)", backdropFilter: "blur(10px)", borderRadius: 18, padding: 12, minHeight: 86, display: "grid", gap: 4 },
  metricIcon: { fontSize: 18 },
  player: { position: "absolute", right: "3%", bottom: -44, width: "min(440px,96%)", maxHeight: 460, objectFit: "contain", filter: "drop-shadow(0 28px 45px rgba(0,0,0,.55))" },
  planPill: { position: "absolute", left: 0, bottom: 18, background: "rgba(34,197,94,.16)", color: "#bbf7d0", border: "1px solid rgba(34,197,94,.30)", borderRadius: 999, padding: "10px 14px", fontWeight: 1000 },
};
