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

  if (!pick && !game) {
    return (
      <section style={styles.emptyCard} className="oddix-v35-top-pick-premium">
        <span style={styles.kicker}>⭐ TOP PICK DO DIA</span>
        <h2 style={styles.emptyTitle}>Aguardando entrada premium</h2>
        <p style={styles.emptyText}>A Oddix só destaca jogo com odds reais, qualidade alta e mercado seguro.</p>
      </section>
    );
  }

  return (
    <section style={styles.card} className="oddix-v35-top-pick-premium">
      <div style={styles.glow} />

      <div style={styles.left}>
        <div style={styles.headerLine}>
          <span style={styles.kicker}>⭐ TOP PICK DO DIA</span>
          <span style={styles.league}>{pick?.league || game?.league?.name || "Oddix Premium"}</span>
        </div>

        <div style={styles.matchBox}>
          <Team logo={teamLogo(game, "home")} name={pick?.homeTeam || teamName(game, "home")} />
          <div style={styles.vs}>VS</div>
          <Team logo={teamLogo(game, "away")} name={pick?.awayTeam || teamName(game, "away")} />
        </div>

        <div style={styles.marketBox}>
          <span>Mercado inteligente</span>
          <strong>{pick?.tip || "Entrada premium protegida"}</strong>
          <small>{pick?.market || "Oddix AI"} • {pick?.risk || "Risco controlado"}</small>
        </div>
      </div>

      <div style={styles.right}>
        <div style={styles.scorePill}>Score {quality || 0}/100</div>

        <div style={styles.oddBox}>
          <span>Odd</span>
          <strong>{pick?.odd || "-"}</strong>
        </div>

        <div style={styles.confidenceBox}>
          <span>Confiança</span>
          <strong>{confidence || 0}%</strong>
          <div style={styles.bar}>
            <div style={{ ...styles.fill, width: `${Math.min(100, Math.max(8, confidence || 0))}%` }} />
          </div>
        </div>

        <button style={styles.button} onClick={isPaidPlan ? onOpen : onUpgrade}>
          {isPaidPlan ? "Ver análise" : "Desbloquear análise"}
        </button>
      </div>
    </section>
  );
}

function Team({ logo, name }: { logo: string; name: string }) {
  return (
    <div style={styles.team}>
      <img style={styles.logo} src={logo} alt={name} />
      <strong>{name}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) minmax(260px,340px)",
    gap: 18,
    alignItems: "stretch",
    background: "radial-gradient(circle at 20% 0%,rgba(250,204,21,.30),transparent 34%),linear-gradient(135deg,#09090b,#171717 52%,#713f12)",
    color: "#fff",
    borderRadius: 32,
    padding: "clamp(18px,2vw,28px)",
    border: "1px solid rgba(250,204,21,.34)",
    boxShadow: "0 26px 80px rgba(0,0,0,.42),0 0 42px rgba(250,204,21,.12)",
  },
  emptyCard: {
    background: "linear-gradient(135deg,#111827,#1f2937)",
    color: "#fff",
    borderRadius: 30,
    padding: 24,
    border: "1px dashed rgba(250,204,21,.30)",
  },
  glow: { position: "absolute", inset: "-120px -90px auto auto", width: 260, height: 260, borderRadius: 999, background: "rgba(250,204,21,.20)", filter: "blur(26px)" },
  left: { position: "relative", zIndex: 2, minWidth: 0 },
  right: { position: "relative", zIndex: 2, display: "grid", alignContent: "center", gap: 12, minWidth: 0 },
  headerLine: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 },
  kicker: { color: "#facc15", fontSize: 12, fontWeight: 1000, letterSpacing: 1.1, textTransform: "uppercase" },
  league: { color: "rgba(255,255,255,.70)", fontSize: 12, fontWeight: 900, textAlign: "right" },
  matchBox: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 64px minmax(0,1fr)", gap: 12, alignItems: "center", marginBottom: 16 },
  team: { display: "grid", justifyItems: "center", gap: 9, textAlign: "center", minWidth: 0 },
  logo: { width: 74, height: 74, borderRadius: 22, objectFit: "contain", background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.16)", padding: 8 },
  vs: { height: 52, borderRadius: 18, display: "grid", placeItems: "center", color: "#111827", background: "#facc15", fontWeight: 1000, boxShadow: "0 12px 30px rgba(250,204,21,.18)" },
  marketBox: { borderRadius: 22, padding: 18, background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.14)" },
  scorePill: { justifySelf: "end", width: "fit-content", borderRadius: 999, padding: "8px 12px", color: "#fde68a", background: "rgba(250,204,21,.12)", border: "1px solid rgba(250,204,21,.22)", fontSize: 12, fontWeight: 1000 },
  oddBox: { borderRadius: 24, padding: 18, background: "#facc15", color: "#111827", textAlign: "center" },
  confidenceBox: { borderRadius: 24, padding: 18, background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.14)" },
  bar: { marginTop: 10, height: 10, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,.14)" },
  fill: { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#22c55e,#facc15)" },
  button: { width: "100%", border: 0, borderRadius: 18, padding: "15px 18px", background: "#22c55e", color: "#052e16", fontWeight: 1000, cursor: "pointer" },
  emptyTitle: { margin: "8px 0", fontSize: 28 },
  emptyText: { color: "#d1d5db" },
};
