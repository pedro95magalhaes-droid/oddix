"use client";

import type { CSSProperties } from "react";

const ODDIX_PLAYER_IMAGE = "/images/oddix-player.png";

export default function DashboardHero({
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
    <section style={styles.hero} className="oddix-v36-hero">
      <div style={styles.goldWash} />
      <div style={styles.gridLines} />

      <div style={styles.content}>
        <strong style={styles.wordmark}>ODDIX <b>AI</b></strong>
        <span style={styles.platform}>SPORTS INTELLIGENCE PLATFORM</span>

        <h1 style={styles.title}>
          Análises esportivas com <span>Inteligência Artificial.</span>
        </h1>

        <div style={styles.badges}>
          <span>✓ Odds Reais</span>
          <span>✓ IA Proprietária</span>
          <span>✓ Player Props Premium</span>
          <span>✓ Estatísticas Avançadas</span>
          <span>✓ Resultados Verificados</span>
          <span>✓ Plataforma Web Premium</span>
        </div>

        <div style={styles.actions}>
          <button style={styles.primary} onClick={onExplore}>Ver análises <b>→</b></button>
          <button style={styles.secondary} onClick={onUpgrade}>♕ Desbloquear Plataforma VIP</button>
        </div>
      </div>

      <div style={styles.playerArea}>
        <img style={styles.player} src={ODDIX_PLAYER_IMAGE} alt="Oddix AI" />
      </div>

      <div style={styles.metrics}>
        <Metric icon="📡" label="Jogos Ao Vivo" value={liveGames} helper="AGORA" />
        <Metric icon="🔥" label="Top Picks" value={topTips} helper="HOJE" />
        <Metric icon="📈" label="Assertividade" value={`${roi || 0}%`} helper="ÚLTIMOS 30 DIAS" green />
        <Metric icon="🎯" label="Player Props" value="Premium" helper="EXCLUSIVO" purple />
      </div>

      <div style={styles.trustBar}>
        <span>🛡️ Dados 100% Reais</span>
        <span>♟️ IA Proprietária Oddix</span>
        <span>⚡ Atualização em Tempo Real</span>
      </div>
    </section>
  );
}

function Metric({ icon, label, value, helper, green, purple }: { icon: string; label: string; value: string | number; helper: string; green?: boolean; purple?: boolean }) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricTop}><span>{icon}</span><b>{label}</b></div>
      <strong style={{ ...styles.metricValue, color: green ? "#22c55e" : purple ? "#c084fc" : "#f8fafc" }}>{value}</strong>
      <small style={styles.metricHelper}>{helper}</small>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    position: "relative",
    overflow: "hidden",
    minHeight: 344,
    display: "grid",
    gridTemplateColumns: "minmax(0,1.05fr) minmax(360px,.85fr) 292px",
    alignItems: "center",
    gap: 18,
    borderRadius: 18,
    padding: "30px 26px 48px 34px",
    color: "#fff",
    background:
      "linear-gradient(90deg,#050505 0%,#090909 42%,rgba(94,53,5,.68) 72%,#080808 100%),radial-gradient(circle at 80% 10%,rgba(250,204,21,.34),transparent 30%)",
    border: "1px solid rgba(250,204,21,.38)",
    boxShadow: "0 26px 70px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06)",
  },
  goldWash: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(circle at 73% 33%,rgba(250,204,21,.22),transparent 35%),linear-gradient(180deg,transparent 77%,rgba(250,204,21,.06))",
    pointerEvents: "none",
  },
  gridLines: {
    position: "absolute",
    inset: 0,
    opacity: .42,
    background: "repeating-linear-gradient(112deg,rgba(250,204,21,.055) 0 1px,transparent 1px 82px),repeating-linear-gradient(0deg,rgba(250,204,21,.035) 0 1px,transparent 1px 70px)",
    pointerEvents: "none",
  },
  content: { position: "relative", zIndex: 3, alignSelf: "center" },
  wordmark: {
    display: "block",
    width: "fit-content",
    fontSize: "clamp(54px,5.4vw,82px)",
    lineHeight: .82,
    fontWeight: 1000,
    fontStyle: "italic",
    letterSpacing: -4,
    color: "#fff",
    textShadow: "0 10px 30px rgba(0,0,0,.65)",
  },
  platform: {
    display: "block",
    marginTop: 14,
    color: "#fff",
    fontSize: 15,
    fontWeight: 1000,
    letterSpacing: 5.2,
  },
  title: {
    margin: "20px 0 14px",
    maxWidth: 640,
    fontSize: "clamp(28px,2.65vw,43px)",
    lineHeight: 1.04,
    letterSpacing: -1.1,
    fontWeight: 1000,
  },
  badges: { display: "flex", flexWrap: "wrap", gap: 7, maxWidth: 670 },
  actions: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 22 },
  primary: { minWidth: 150, border: 0, borderRadius: 10, padding: "14px 24px", background: "linear-gradient(180deg,#fde047,#eab308)", color: "#09090b", fontWeight: 1000, cursor: "pointer", boxShadow: "0 18px 38px rgba(250,204,21,.22)" },
  secondary: { minWidth: 245, border: "1px solid rgba(250,204,21,.45)", borderRadius: 10, padding: "14px 24px", background: "rgba(0,0,0,.32)", color: "#fff", fontWeight: 1000, cursor: "pointer" },
  playerArea: { position: "relative", zIndex: 2, alignSelf: "stretch", minHeight: 300 },
  player: { position: "absolute", left: "-6%", right: 0, bottom: -54, width: "min(430px,112%)", height: "calc(100% + 58px)", objectFit: "contain", objectPosition: "center bottom", filter: "drop-shadow(0 28px 45px rgba(0,0,0,.78)) saturate(1.12) contrast(1.05)" },
  metrics: { position: "relative", zIndex: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignSelf: "center" },
  metric: { minHeight: 104, borderRadius: 13, padding: 14, display: "grid", alignContent: "center", gap: 6, background: "rgba(0,0,0,.55)", border: "1px solid rgba(250,204,21,.45)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)", backdropFilter: "blur(10px)" },
  metricTop: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 },
  metricValue: { fontSize: 34, lineHeight: 1, letterSpacing: -.9 },
  metricHelper: { color: "#d4d4d8", fontSize: 11, fontWeight: 900 },
  metricIcon: {},
  trustBar: { position: "absolute", zIndex: 5, left: 34, right: 0, bottom: 0, height: 34, display: "flex", alignItems: "center", gap: 34, padding: "0 18px", background: "rgba(0,0,0,.55)", borderTop: "1px solid rgba(250,204,21,.12)", color: "#84cc16", fontSize: 12, fontWeight: 900 },
};
