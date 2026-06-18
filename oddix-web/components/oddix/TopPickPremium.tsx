"use client";

import type { CSSProperties } from "react";

function teamLogo(game: any, side: "home" | "away") {
  const team = game?.teams?.[side] || {};
  return team?.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(team?.name || side)}&background=111827&color=ffffff&bold=true`;
}

function teamName(game: any, side: "home" | "away") {
  return game?.teams?.[side]?.name || (side === "home" ? "Casa" : "Fora");
}

export default function TopPickPremium({
  pick,
  game,
  isPaidPlan = false,
  onOpen,
  onUpgrade,
}: {
  pick?: any;
  game?: any;
  isPaidPlan?: boolean;
  onOpen: () => void;
  onUpgrade: () => void;
}) {
  const confidence = Number(pick?.confidence || 0);
  const quality = Number(pick?.qualityScore || game?.oddix?.qualityScore || 0);
  const odd = pick?.odd || "-";
  const tip = String(pick?.tip || "Entrada premium protegida");
  const main = tip.replace(/mercado inteligente/i, "").trim();

  if (!pick && !game) {
    return (
      <section style={styles.card} className="oddix-v36-top-pick">
        <span style={styles.kicker}>⭐ TOP PICK DO DIA</span>
        <div style={styles.empty}>Aguardando entrada premium com odds reais.</div>
      </section>
    );
  }

  return (
    <section style={styles.card} className="oddix-v36-top-pick">
      <div style={styles.header}>
        <span style={styles.kicker}>⭐ TOP PICK DO DIA</span>
        <span style={styles.score}>🏆 Score: {quality || 0}/100</span>
      </div>

      <div style={styles.body}>
        <div style={styles.match}>
          <Team logo={teamLogo(game, "home")} name={pick?.homeTeam || teamName(game, "home")} />
          <div style={styles.center}>
            <strong>{pick?.league || game?.league?.name || "Oddix Premium"}</strong>
            <small>{game?.fixture?.date ? new Date(game.fixture.date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Mercado real"}</small>
            <b>VS</b>
          </div>
          <Team logo={teamLogo(game, "away")} name={pick?.awayTeam || teamName(game, "away")} />
        </div>

        <div style={styles.metrics}>
          <div style={styles.metricBlock}>
            <span>Mercado</span>
            <strong style={styles.market}>{main}</strong>
            <small>{pick?.market || "Oddix AI"}</small>
          </div>
          <div style={styles.metricBlock}>
            <span>Odd</span>
            <strong style={styles.odd}>{odd}</strong>
          </div>
          <div style={styles.metricBlock}>
            <span>Confiança</span>
            <strong style={styles.confidence}>{confidence || 0}%</strong>
            <small>{confidence >= 88 ? "Muito alta" : confidence >= 78 ? "Alta" : "Controlada"}</small>
          </div>
          <button style={styles.button} onClick={isPaidPlan ? onOpen : onUpgrade}>VER ANÁLISE COMPLETA <b>→</b></button>
        </div>
      </div>
    </section>
  );
}

function Team({ logo, name }: { logo: string; name: string }) {
  return (
    <div style={styles.team}>
      <img src={logo} alt={name} style={styles.logo} />
      <strong>{name}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gap: 12,
    color: "#fff",
    borderRadius: 17,
    padding: "16px 18px 18px",
    background: "linear-gradient(90deg,#070707,#11100a 50%,rgba(101,56,5,.82)),radial-gradient(circle at 18% 0%,rgba(250,204,21,.34),transparent 30%)",
    border: "1px solid rgba(250,204,21,.86)",
    boxShadow: "0 0 34px rgba(250,204,21,.38),0 26px 70px rgba(0,0,0,.52),inset 0 1px 0 rgba(255,255,255,.08)",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  kicker: { color: "#facc15", fontSize: 16, fontWeight: 1000, letterSpacing: 1.2, textTransform: "uppercase" },
  score: { color: "#fde68a", background: "rgba(250,204,21,.10)", border: "1px solid rgba(250,204,21,.5)", borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 1000 },
  body: { display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(575px,1.25fr)", gap: 24, alignItems: "center" },
  match: { display: "grid", gridTemplateColumns: "1fr 125px 1fr", alignItems: "center", gap: 12 },
  team: { display: "grid", justifyItems: "center", gap: 8, textAlign: "center", textTransform: "uppercase", fontWeight: 1000, minWidth: 0 },
  logo: { width: 118, height: 118, objectFit: "contain", borderRadius: 18, filter: "drop-shadow(0 14px 18px rgba(0,0,0,.6))" },
  center: { display: "grid", justifyItems: "center", textAlign: "center", gap: 4, textTransform: "uppercase" },
  metrics: { display: "grid", gridTemplateColumns: "1.15fr .68fr .82fr 1.08fr", alignItems: "stretch", minHeight: 120, borderRadius: 14, overflow: "hidden", background: "rgba(0,0,0,.22)", border: "1px solid rgba(250,204,21,.18)" },
  metricBlock: { display: "grid", alignContent: "center", justifyItems: "center", gap: 5, padding: "16px 12px", borderRight: "1px solid rgba(250,204,21,.18)", textAlign: "center" },
  market: { color: "#facc15", fontSize: "clamp(23px,2vw,34px)", lineHeight: 1, textTransform: "uppercase" },
  odd: { color: "#facc15", fontSize: "clamp(40px,4vw,64px)", lineHeight: .86 },
  confidence: { color: "#22c55e", fontSize: "clamp(38px,3.6vw,61px)", lineHeight: .88 },
  button: { margin: 14, border: 0, borderRadius: 8, background: "linear-gradient(180deg,#fde047,#eab308)", color: "#09090b", fontSize: 15, fontWeight: 1000, cursor: "pointer", boxShadow: "0 16px 34px rgba(250,204,21,.2)" },
  empty: { padding: 20, color: "#cbd5e1" },
};
